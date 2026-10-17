import { randomBytes, randomUUID } from "node:crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { testPool, resetTestData } from "../database";
import { provisionEmployee } from "../../src/server/provisioning";
const pool=testPool(), password=randomBytes(20).toString("hex"), origin="http://127.0.0.1:3100";
let productId:string,courtId:string,ownerId:string;
test.setTimeout(50_000);
test.beforeEach(async()=>{
 await resetTestData(pool);
 ownerId=await provisionEmployee(pool,{email:"owner@preparation.example.invalid",name:"Owner Tester",password,roles:["owner"]});
 await provisionEmployee(pool,{email:"preparation@preparation.example.invalid",name:"Preparation Tester",password,roles:["preparation"]});
 await provisionEmployee(pool,{email:"supervisor@preparation.example.invalid",name:"Supervisor Tester",password,roles:["supervisor"]});
 productId=randomUUID();courtId=randomUUID();const building=randomUUID();
 await pool.query("INSERT INTO product(id,name,name_en,category,category_en,price_idr) VALUES ($1,'Kopi susu','Milk coffee','Minuman','Drinks',25000)",[productId]);
 await pool.query("INSERT INTO building(id,name) VALUES ($1,'Sports Hall')",[building]);
 await pool.query("INSERT INTO location(id,building_id,kind,name) VALUES ($1,$2,'court','Padel 1')",[courtId,building]);
});
test.afterAll(async()=>{await resetTestData(pool);await pool.end();});
async function login(page:Page,role="owner"){
 await page.goto("/employee/sign-in");await page.getByLabel("Email",{exact:true}).fill(`${role}@preparation.example.invalid`);await page.getByLabel("Password",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByText("Signed in as")).toBeVisible();
 await page.getByRole("link",{name:"Preparation queue",exact:true}).click();await page.getByRole("button",{name:"EN",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Let’s get drinks ready."})).toBeVisible();
}
async function create(request:APIRequestContext,name="Court Guest"){
 const input={id:randomUUID(),accessKey:randomBytes(32).toString("hex"),customerName:name,phone:"081234567890",kind:"court",locationId:courtId,locationConfirmed:true,items:[{productId,quantity:2,priceIdr:25000}]};
 const response=await request.post("/api/orders/create",{headers:{origin},data:input});expect(response.status()).toBe(201);return {input,order:await response.json()};
}
test("customer checkout progresses through owner preparation, remains unpaid and works on mobile",async({page,browser})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(`/?court=${courtId}`);await page.getByRole("button",{name:"EN",exact:true}).click();await page.getByRole("button",{name:"Add Milk coffee",exact:true}).click();await page.getByRole("link",{name:/View cart/}).click();
 await page.getByLabel("Customer name",{exact:true}).fill("Courtside Guest");await page.getByLabel("Phone / WhatsApp number").fill("081234567890");await page.getByLabel("I have checked the building and court above.").check();
 await page.getByRole("button",{name:"Place order",exact:true}).click();await expect(page.getByRole("heading",{name:"Order received",exact:true})).toBeVisible();
 const order=(await pool.query("SELECT id,public_reference FROM customer_order")).rows[0];
 const context=await browser.newContext(),staff=await context.newPage();staff.on("pageerror",e=>errors.push(e.message));await login(staff);
 await staff.setViewportSize({width:390,height:844});
 const ticket=staff.getByRole("article",{name:order.public_reference});await expect(ticket.getByRole("heading",{name:"Sports Hall / Padel 1"})).toBeVisible();
 expect(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await staff.screenshot({path:".local/v2-2-preparation-mobile.png",fullPage:true});
 await ticket.getByRole("button",{name:"Claim order",exact:true}).click();await expect(staff.getByRole("button",{name:"Mark ready",exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Your drinks are being prepared",exact:true})).toBeVisible({timeout:12_000});await expect(page.getByRole("button",{name:"Cancel before staff claim preparation"})).toHaveCount(0);
 await staff.getByRole("button",{name:"Mark ready",exact:true}).click();await expect(staff.getByText("Prepared, awaiting delivery. Delivery staff can claim it; payment verification is not available yet.",{exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Your drinks are ready",exact:true})).toBeVisible({timeout:12_000});
 await staff.reload();await staff.getByRole("tab",{name:/Ready/}).click();await expect(staff.getByRole("article",{name:order.public_reference})).toBeVisible();
 expect((await pool.query("SELECT state,total_idr FROM customer_order WHERE id=$1",[order.id])).rows[0]).toEqual({state:"ready",total_idr:25000});
 expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");expect(errors).toEqual([]);await context.close();
});
test("lost committed claim response retries one durable command without duplicate ownership",async({page,request})=>{
 const {order}=await create(request);await login(page);
 await page.route("**/api/employee/preparation",async route=>{const response=await route.fetch();expect(response.status()).toBe(200);await route.fulfill({status:503,json:{error:{code:"UNAVAILABLE"}}});},{times:1});
 await page.getByRole("button",{name:"Claim order",exact:true}).click();await expect(page.getByRole("button",{name:"Retry action",exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole("button",{name:"Retry action",exact:true})).toBeEnabled({timeout:12_000});await page.getByRole("button",{name:"Retry action",exact:true}).click();
 await expect(page.getByRole("button",{name:"Mark ready",exact:true})).toBeVisible();
 expect((await pool.query("SELECT count(*) FROM preparation_command WHERE order_id=$1 AND kind='claim'",[order.id])).rows[0].count).toBe("1");
});
test("two signed-in employees cannot claim the same order",async({page,browser,request})=>{
 const {order}=await create(request);await login(page);const context=await browser.newContext(),other=await context.newPage();await login(other,"preparation");
 await Promise.all([page.getByRole("button",{name:"Claim order",exact:true}).click(),other.getByRole("button",{name:"Claim order",exact:true}).click()]);
 await expect.poll(async()=>Number((await pool.query("SELECT count(*) FROM preparation_command WHERE order_id=$1 AND kind='claim'",[order.id])).rows[0].count)).toBe(1);
 await expect.poll(async()=>await page.getByRole("button",{name:"Mark ready",exact:true}).count()+await other.getByRole("button",{name:"Mark ready",exact:true}).count()).toBe(1);
 await context.close();
});
test("pause blocks fresh checkout, resume restores it, review reason holds existing work",async({page,browser,request})=>{
 const {order}=await create(request);await login(page);
 const service=page.getByRole("region",{name:"Ordering service"});await service.locator("summary").click();await service.getByLabel("Reason",{exact:true}).fill("Preparation break");await service.getByRole("button",{name:"Pause new orders",exact:true}).click();
 await expect(service.getByText("New orders paused",{exact:false})).toBeVisible({timeout:12_000});
 const context=await browser.newContext(),guest=await context.newPage();await guest.goto(`/?court=${courtId}`);await guest.getByRole("button",{name:"EN",exact:true}).click();await expect(guest.getByText("Ordering is temporarily paused.",{exact:false})).toBeVisible();
 await guest.getByRole("button",{name:"Add Milk coffee",exact:true}).click();await guest.getByRole("link",{name:/View cart/}).click();await expect(guest.getByRole("button",{name:"Place order",exact:true})).toBeDisabled();
 await service.getByRole("button",{name:"Resume ordering",exact:true}).click();await expect(service.getByText("Accepting court orders",{exact:false})).toBeVisible({timeout:12_000});
 await guest.getByRole("button",{name:"Check ordering availability",exact:true}).click();await expect(guest.getByRole("button",{name:"Place order",exact:true})).toBeEnabled();
 const ticket=page.getByRole("article",{name:order.reference});await ticket.getByText("Flag for review",{exact:true}).click();await ticket.getByLabel("Reason",{exact:true}).fill("Drink unavailable");await ticket.getByRole("button",{name:"Hold for review",exact:true}).click();
 await expect(page.getByText("Drink unavailable",{exact:true})).toBeVisible();expect((await pool.query("SELECT state,reason FROM customer_order WHERE id=$1",[order.id])).rows[0]).toEqual({state:"exception",reason:"Drink unavailable"});await context.close();
});
test("passive polling clears private work after idle expiry and supervisors only view",async({page,request,browser})=>{
 const {order}=await create(request,"Private Guest");await login(page);await expect(page.getByText("Private Guest",{exact:true})).toBeVisible();
 await pool.query("UPDATE session SET last_activity_at=clock_timestamp()-interval '30 minutes' WHERE user_id=$1",[ownerId]);
 await expect(page.getByText("Your session ended or access changed. Sign in again.",{exact:true})).toBeVisible({timeout:12_000});await expect(page.getByText("Private Guest",{exact:true})).toHaveCount(0);
 const context=await browser.newContext(),supervisor=await context.newPage();await login(supervisor,"supervisor");await expect(supervisor.getByRole("article",{name:order.reference})).toBeVisible();await expect(supervisor.getByRole("button",{name:"Claim order",exact:true})).toHaveCount(0);await expect(supervisor.getByText("View only.",{exact:false})).toBeVisible();await context.close();
});
test("stale queue warns, prevents actions and recovers through refresh without relying on sound",async({page,request})=>{
 const {order}=await create(request);await login(page);await expect(page.getByRole("article",{name:order.reference})).toBeVisible();
 await page.route("**/api/employee/preparation?*",route=>route.abort());
 await expect(page.getByText("Updates are delayed.",{exact:false}).first()).toBeVisible({timeout:20_000});await expect(page.getByRole("button",{name:"Claim order",exact:true})).toBeDisabled({timeout:20_000});
 await page.unroute("**/api/employee/preparation?*");await page.getByRole("button",{name:"Refresh",exact:true}).click();await expect(page.getByRole("button",{name:"Claim order",exact:true})).toBeEnabled({timeout:12_000});await expect(page.getByText("Updates are delayed.",{exact:false})).toHaveCount(0);
 await page.setViewportSize({width:1280,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:".local/v2-2-preparation-desktop.png",fullPage:true});
});

test("missed sound never hides newly arriving work",async({page,request})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,"AudioContext",{value:class{constructor(){throw Error("Audio blocked");}}});});
 await login(page);await expect(page.getByText("All caught up here.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Enable sound",exact:true}).click();await expect(page.getByText("Sound is unavailable.",{exact:false})).toBeVisible();
 const {order}=await create(request,"Arriving Guest");await expect(page.getByRole("article",{name:order.reference})).toBeVisible({timeout:12_000});await expect(page.getByRole("button",{name:"Claim order",exact:true})).toBeEnabled();
});
