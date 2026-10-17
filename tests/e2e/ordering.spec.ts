import { createHash, randomBytes, randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { testPool, resetTestData } from "../database";
import { provisionEmployee } from "../../src/server/provisioning";
const pool = testPool(), password = randomBytes(20).toString("hex");
let productId: string, courtId: string, tableId: string;
const origin = "http://127.0.0.1:3100";
test.beforeEach(async () => {
  await resetTestData(pool);
  await provisionEmployee(pool, { email: "owner@ordering.example.invalid", name: "Demo Owner", password, roles: ["owner"] });
  await provisionEmployee(pool, { email: "counter@ordering.example.invalid", name: "Counter Tester", password, roles: ["counter"] });
  productId = randomUUID(); courtId = randomUUID(); tableId = randomUUID(); const buildingId = randomUUID();
  await pool.query("INSERT INTO product (id,name,name_en,category,category_en,price_idr) VALUES ($1,'Kopi demo','Demo coffee','Minuman','Drinks',25000)", [productId]);
  await pool.query("INSERT INTO building (id,name) VALUES ($1,'Demo Hall')", [buildingId]);
  await pool.query("INSERT INTO location (id,building_id,kind,name,table_number) VALUES ($1,$2,'court','Padel 1',null),($3,$2,'table','7',7)", [courtId, buildingId, tableId]);
});
test.afterAll(async () => { await resetTestData(pool); await pool.end(); });
async function login(page: Page, role = "owner") {
  await page.goto("/employee/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@ordering.example.invalid`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}
async function cart(page: Page, confirm = true) {
  await page.goto(`/?court=${courtId}`);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Add Demo coffee", exact: true }).click();
  await page.getByRole("link", { name: /View cart/ }).click();
  await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue(courtId);
  await page.getByLabel("Customer name", { exact: true }).fill("Browser Guest");
  await page.getByLabel("Phone / WhatsApp number").fill("081234567890");
  if (confirm) await page.getByLabel("I have checked the building and court above.").check();
}
// Historical v1 browser regression fixture, persisted with real constraints/transaction.
// New customer HTTP checkout cannot create this legacy payment workflow.
async function seededOrder(_page: Page, name = "Browser Guest") {
  const id=randomUUID(), accessKey=randomBytes(32).toString("hex"), transactionId=randomUUID();
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO customer_order (id,request_digest,access_hash,source,customer_name,kind,destination,total_idr,demo_transaction_id,pickup_code,expires_at,access_expires_at)
      VALUES ($1,'historical_browser_fixture',$2,'guest',$3,'pickup','Café pickup',25000,$4,$5,now()+interval '15 minutes',now()+interval '24 hours')`,[id,createHash("sha256").update(accessKey).digest("hex"),name,transactionId,randomBytes(5).toString("hex")]);
    await client.query("INSERT INTO order_item (order_id,product_id,name,description,quantity,unit_price_idr) VALUES ($1,$2,'Kopi demo','',1,25000)",[id,productId]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return {id,accessKey,order:{demoTransactionId:transactionId}};
}
test("court checkout survives a lost committed response and preserves private recovery", async ({page,browser})=>{
  await cart(page);
  await page.getByRole("button",{name:"Increase Kopi demo"}).click();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:".local/v2-checkout-mobile.png",fullPage:true});
  let id="";
  await page.route("**/api/orders/create",async route=>{
    const response=await route.fetch();expect(response.status()).toBe(201);id=(await response.json()).id;
    await route.fulfill({status:503,json:{error:{code:"UNAVAILABLE"}}});
  },{times:1});
  await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByText("The save result is uncertain.",{exact:false})).toBeVisible();
  await expect(page.getByLabel("Customer name",{exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Retry saving order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/orders/${id}`);
  const row=(await pool.query("SELECT state,total_idr,public_reference,expires_at FROM customer_order")).rows[0];
  expect(row).toMatchObject({state:"awaiting_preparation",total_idr:50000,expires_at:null});
  await expect(page.getByText(row.public_reference,{exact:true})).toBeVisible();
  await page.screenshot({path:".local/v2-status-mobile.png",fullPage:true});
  await page.reload();await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  await page.getByText("Keep access to your order",{exact:true}).click();
  const recovery=await page.getByRole("textbox",{name:"Save this private link"}).inputValue();
  const otherContext=await browser.newContext(),other=await otherContext.newPage();
  await other.goto(recovery);await expect(other.getByRole("heading",{name:"Pesanan diterima",exact:true})).toBeVisible();
  expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("1");
  await otherContext.close();
});
test("changed prices require review and renewed court confirmation",async({page})=>{
  await cart(page);await pool.query("UPDATE product SET price_idr=30000");
  await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Prices changed"})).toBeVisible();
  expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
  await page.getByRole("button",{name:"Reload menu and review prices"}).click();
  await expect(page.getByLabel("I have checked the building and court above.")).not.toBeChecked();
  await page.getByLabel("I have checked the building and court above.").check();
  await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  expect((await pool.query("SELECT total_idr FROM customer_order")).rows[0].total_idr).toBe(30000);
});
test("court is the only mode and requires explicit confirmation before submission",async({page})=>{
  await cart(page,false);
  await expect(page.getByLabel("Order for",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Place order",exact:true}).click();
  expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
  await page.getByLabel("I have checked the building and court above.").check();
  await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  await expect(page.getByText("Demo Hall / Padel 1",{exact:true})).toBeVisible();
  await expect(page.getByText("Waiting for simulated payment",{exact:true})).toHaveCount(0);
});
test("court cancellation is idempotent and status read failures never imply success",async({page})=>{
  await cart(page);await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  await page.route("**/api/orders/cancel",route=>route.fulfill({status:503,json:{error:{code:"UNAVAILABLE"}}}),{times:1});
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Cancel before staff claim preparation"}).click();
  expect((await pool.query("SELECT state FROM customer_order")).rows[0].state).toBe("awaiting_preparation");
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Cancel before staff claim preparation"}).click();
  await expect(page.getByRole("heading",{name:"Order closed",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Cancel before staff claim preparation"})).toHaveCount(0);
  expect((await pool.query("SELECT count(*) FROM order_event WHERE kind='canceled'")).rows[0].count).toBe("1");
});
test("counter routes are deferred and public clients cannot forge or simulate court payments",async({page})=>{
  await cart(page);await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  const order=(await pool.query("SELECT id FROM customer_order")).rows[0];
  const forged=await page.request.post("/api/orders/mark-paid",{headers:{origin},data:{id:order.id,paid:true}});expect(forged.status()).toBe(404);
  const denied=await page.request.post("/api/employee/orders/event",{headers:{origin},data:{}});expect(denied.status()).toBe(401);
  await page.goto(`/orders/${order.id}#${randomBytes(32).toString("hex")}`);
  await expect(page.getByRole("alert").filter({hasText:"This link is invalid"})).toBeVisible();
  await login(page);
  await expect(page.getByRole("link",{name:"Create counter order",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Demo payment controls",exact:true})).toHaveCount(0);
  const response=await page.request.post("/api/employee/orders/create",{headers:{origin},data:{}});expect(response.status()).toBe(404);
  expect((await page.goto("/employee/counter"))?.status()).toBe(404);
  const simulated=await page.request.post("/api/employee/orders/event",{headers:{origin},data:{deliver:true,payload:{eventId:randomUUID(),orderId:order.id,transactionId:randomUUID(),flow:"payment",status:"succeeded",amountIdr:25000,currency:"IDR"}}});
  expect(simulated.status()).toBe(409);
  expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");
});
test("a delayed cancellation response cannot restore details after the private key changes",async({page})=>{
  await page.clock.install();
  await cart(page);await page.getByRole("button",{name:"Place order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  let release!:()=>void, signal!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}), requested=new Promise<void>(resolve=>{signal=resolve;});
  await page.route("**/api/orders/cancel",async route=>{const response=await route.fetch();signal();await gate;await route.fulfill({response});});
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel before staff claim preparation"}).click();
  await requested;await page.clock.fastForward(6000);
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
  await page.evaluate(()=>{window.location.hash="invalid";});
  await expect(page.getByRole("alert").filter({hasText:"This link is invalid"})).toBeVisible();
  const finished=page.waitForResponse(response=>response.url().endsWith("/api/orders/cancel"));release();await finished;
  await expect(page.getByRole("heading",{name:"Order closed",exact:true})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Order received",exact:true})).toHaveCount(0);
  await expect(page.getByText("Order details",{exact:false})).toHaveCount(0);
});
test("customer menu and checkout remain usable at mobile and desktop sizes",async({page})=>{
  await pool.query("INSERT INTO product (id,name,name_en,description,description_en,category,category_en,price_idr) VALUES ($1,'Es teh lemon','Lemon iced tea','Teh segar dan lemon','Fresh tea with lemon','Minuman','Drinks',22000),($2,'Air mineral','Mineral water','Dingin dan menyegarkan','Chilled and refreshing','Minuman','Drinks',12000)",[randomUUID(),randomUUID()]);
  await page.goto(`/?court=${courtId}`);await page.getByRole("button",{name:"EN",exact:true}).click();
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`.local/v2-menu-${width}.png`,fullPage:true});
  }
});
test("owner controls accept one payment, replay safely and refund only the extra payment", async ({ page, browser }) => {
  const value = await seededOrder(page);
  await page.goto(`/orders/${value.id}#${value.accessKey}`);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  const staffContext = await browser.newContext(), staff = await staffContext.newPage();
  await login(staff); await staff.goto("/employee/demo-payments");
  await staff.getByRole("button", { name: /Browser Guest/ }).click();
  await staff.getByRole("button", { name: "Simulate successful payment", exact: true }).click();
  await expect(staff.getByRole("heading", { name: "Simulated payment accepted" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh status", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Simulated payment accepted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel unpaid order" })).toHaveCount(0);
  await staff.getByRole("button", { name: "Replay event", exact: true }).click();
  await expect(staff.getByRole("status").filter({ hasText: "accepted_for_preparation" })).toBeVisible();
  expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("1");
  await staff.getByRole("button", { name: "Simulate extra payment", exact: true }).click();
  await expect(staff.getByRole("heading", { name: "Rp 25.000 · Review / extra payment" })).toBeVisible();
  await staff.getByLabel("Cancellation/refund reason").fill("Duplicate simulated payment");
  const extra = staff.locator("article.order-panel").filter({ has: staff.getByRole("heading", { name: "Rp 25.000 · Review / extra payment" }) });
  await extra.getByRole("button", { name: "Request full simulated refund" }).click();
  await extra.getByRole("button", { name: "Keep outcome unknown" }).click();
  await expect(extra.getByRole("button", { name: "Request full simulated refund" })).toBeDisabled();
  await extra.getByRole("button", { name: "Simulate refund success" }).click();
  await page.getByRole("button", { name: "Refresh status", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Simulated payment accepted" })).toBeVisible();
  await expect(page.getByText("Simulated funds refunded: Rp 25.000")).toBeVisible();
  await staffContext.close();
});
test("canceled orders retain delayed payment evidence for review", async ({ page, browser }) => {
  const value = await seededOrder(page);
  await page.goto(`/orders/${value.id}#${value.accessKey}`); await page.getByRole("button", { name: "EN", exact: true }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel unpaid order" }).click();
  await expect(page.getByRole("heading", { name: "Order closed" })).toBeVisible();
  const staffContext = await browser.newContext(), staff = await staffContext.newPage();
  await login(staff); await staff.goto("/employee/demo-payments"); await staff.getByRole("button", { name: /Browser Guest/ }).click();
  await staff.getByRole("button", { name: "Store success without delivery" }).click();
  await expect(staff.getByText("payment / succeeded · Not delivered")).toBeVisible();
  await staff.getByRole("button", { name: "Reconcile undelivered events" }).click();
  await expect(staff.getByRole("heading", { name: "Staff review required" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("heading", { name: "Staff review required" })).toBeVisible();
  expect((await pool.query("SELECT count(*) FROM payment_transaction WHERE is_primary")).rows[0].count).toBe("0");
  await staffContext.close();
});
