import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, resetTestData } from "../database";
import { createCourtOrder, createOrder, guestOrder } from "../../src/server/orders";
import { getPool } from "../../src/server/db/client";
import { digest } from "../../src/server/order-db";
import { readConfig } from "../../src/server/config";
import { publicCatalog } from "../../src/server/catalog";
import { provisionEmployee } from "../../src/server/provisioning";
import { authRequest } from "../../src/server/auth-http";
import { issueDemoEvent } from "../../src/server/demo-payments";
import { POST } from "../../src/app/api/orders/[action]/route";
const pool = testPool(), config = readConfig();
let productId: string, courtId: string, buildingId: string;
const input = () => ({ id: randomUUID(), accessKey: randomBytes(32).toString("hex"), customerName: "Court Guest", phone: "081234567890", kind: "court", locationId: courtId, locationConfirmed: true,
  items: [{ productId, quantity: 2, priceIdr: 17000 }] });
const key = (value: ReturnType<typeof input>) => ({ id: value.id, accessKey: value.accessKey });
beforeEach(async () => {
  await resetTestData(pool); productId = randomUUID(); courtId = randomUUID(); buildingId = randomUUID();
  await pool.query("INSERT INTO product (id,name,category,price_idr) VALUES ($1,'Court coffee','Drinks',17000)", [productId]);
  await pool.query("INSERT INTO building (id,name) VALUES ($1,'Court Test Hall')", [buildingId]);
  await pool.query("INSERT INTO location (id,building_id,kind,name) VALUES ($1,$2,'court','Padel 1')", [courtId, buildingId]);
});
afterAll(async () => { await resetTestData(pool); await pool.end(); await getPool().end(); });
describe("v2 court checkout without payment verification", () => {
  it("commits unpaid preparation eligibility, exact immutable snapshots and a unique non-secret reference", async () => {
    const value = input(), order = await createCourtOrder(value);
    expect(order).toMatchObject({ state: "awaiting_preparation", workflow: "court_test", reference: expect.stringMatching(/^LB-[A-F0-9]{10}$/), totalIdr: 34000,
      receivedIdr: "0", paymentStatus: "unpaid", expiresAt: null, demoTransactionId: null, testOnly: true, simulated: false });
    const row = (await pool.query("SELECT access_hash,access_expires_at-created_at AS access_window FROM customer_order WHERE id=$1", [order.id])).rows[0];
    expect(row.access_hash).toBe(digest(value.accessKey)); expect(row.access_window.days).toBe(1);
    expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");
    await pool.query("UPDATE product SET price_idr=19000,name='Changed',available=false");
    await pool.query("UPDATE location SET name='Changed court',active=false");
    const recovered = await guestOrder(key(value));
    expect(recovered.items[0]).toMatchObject({ name: "Court coffee", unitPriceIdr: 17000, quantity: 2 });
    expect(recovered.destination).toBe("Court Test Hall / Padel 1");
    expect(recovered.state).toBe("awaiting_preparation");
  });
  it("serializes first submissions/retries and refuses body or access-key substitution", async () => {
    const value = input();
    const [a,b] = await Promise.all([createCourtOrder(value), createCourtOrder(value)]);
    expect(a.id).toBe(b.id); expect(a.reference).toBe(b.reference);
    await expect(createCourtOrder({ ...value, customerName: "Another customer" })).rejects.toMatchObject({ code: "CHECKOUT_ID_REUSED" });
    await expect(createCourtOrder({ ...value, accessKey: randomBytes(32).toString("hex") })).rejects.toMatchObject({ code: "CHECKOUT_ID_REUSED" });
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("1");
    expect((await pool.query("SELECT count(*) FROM order_event WHERE kind='created'")).rows[0].count).toBe("1");
  });
  it("rejects deferred service modes, forged paid fields, stale prices and inactive courts", async () => {
    for (const kind of ["pickup", "dine_in"]) await expect(createCourtOrder({ ...input(), kind })).rejects.toMatchObject({ code: "COURT_ONLY" });
    await expect(createCourtOrder({ ...input(), paid: true })).rejects.toMatchObject({ status: 400 });
    await expect(createCourtOrder({ ...input(), items: [{ productId, quantity: 1, priceIdr: 1 }] })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    await expect(createCourtOrder({ ...input(), locationConfirmed: false })).rejects.toMatchObject({ code: "LOCATION_CONFIRMATION_REQUIRED" });
    await pool.query("UPDATE building SET active=false");
    await expect(createCourtOrder(input())).rejects.toMatchObject({ code: "LOCATION_UNAVAILABLE" });
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
  });
  it("retains older unpaid orders instead of auto-canceling them after the old demo deadline", async () => {
    const value = input(), order = await createCourtOrder(value), oldId = randomUUID(), access = randomBytes(32).toString("hex");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO customer_order (id,request_digest,access_hash,source,customer_name,phone,kind,location_id,destination,total_idr,evidence_mode,state,public_reference,created_at,access_expires_at)
        SELECT $1,request_digest,$2,source,customer_name,phone,kind,location_id,destination,total_idr,evidence_mode,state,'LB-ABCDEF1234',now()-interval '2 hours',now()+interval '22 hours' FROM customer_order WHERE id=$3`, [oldId,digest(access),order.id]);
      await client.query("INSERT INTO order_item SELECT $1,product_id,name,name_en,description,description_en,quantity,unit_price_idr FROM order_item WHERE order_id=$2", [oldId, order.id]);
      await client.query("COMMIT");
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    expect(await guestOrder({ id: oldId, accessKey: access })).toMatchObject({ state: "awaiting_preparation", expiresAt: null, paymentStatus: "unpaid" });
  });
  it("isolates private access and records concurrent cancellation once without reopening", async () => {
    const value = input(); await createCourtOrder(value);
    await expect(guestOrder({ id: value.id, accessKey: randomBytes(32).toString("hex") })).rejects.toMatchObject({ status: 404 });
    const result = await Promise.all([guestOrder(key(value),true), guestOrder(key(value),true)]);
    expect(result.every(order => order.state === "canceled")).toBe(true);
    expect((await pool.query("SELECT count(*) FROM order_event WHERE kind='canceled'")).rows[0].count).toBe("1");
    await expect(pool.query("UPDATE customer_order SET state='awaiting_preparation' WHERE id=$1",[value.id])).rejects.toMatchObject({ code: "23514" });
    await pool.query("UPDATE customer_order SET access_expires_at=created_at+interval '1 millisecond' WHERE id=$1",[value.id]);
    await new Promise(resolve=>setTimeout(resolve,5));
    await expect(guestOrder(key(value))).rejects.toMatchObject({ status: 404 });
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("1");
  });
  it("rolls back creation if audit persistence fails and safely retries the same draft", async () => {
    const value = input();
    await pool.query("CREATE FUNCTION test_reject_court_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$");
    await pool.query("CREATE TRIGGER test_court_audit BEFORE INSERT ON order_event FOR EACH ROW EXECUTE FUNCTION test_reject_court_audit()");
    try {
      await expect(createCourtOrder(value)).rejects.toBeDefined();
      expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
      expect((await pool.query("SELECT count(*) FROM order_item")).rows[0].count).toBe("0");
    } finally { await pool.query("DROP TRIGGER test_court_audit ON order_event"); await pool.query("DROP FUNCTION test_reject_court_audit()"); }
    expect((await createCourtOrder(value)).state).toBe("awaiting_preparation");
  });
  it("rejects simulated finance for court orders at service and database boundaries", async () => {
    const value=input(), order=await createCourtOrder(value), password=randomBytes(20).toString("hex");
    await provisionEmployee(pool,{email:"court-owner@example.invalid",name:"Owner",password,roles:["owner"]});
    const login=await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({email:"court-owner@example.invalid",password})}));
    expect(login.status).toBe(200);
    const headers=new Headers({cookie:login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ")});
    await expect(issueDemoEvent(headers,{deliver:true,payload:{eventId:randomUUID(),orderId:order.id,transactionId:randomUUID(),flow:"payment",status:"succeeded",amountIdr:34000,currency:"IDR"}})).rejects.toMatchObject({code:"COURT_PAYMENT_VERIFICATION_UNAVAILABLE"});
    await expect(pool.query("INSERT INTO payment_transaction (id,order_id,amount_idr,currency,matched,is_primary) VALUES ($1,$2,34000,'IDR',true,false)",[randomUUID(),order.id])).rejects.toMatchObject({code:"23514"});
    for(const query of ["UPDATE customer_order SET state='queued_for_preparation'","UPDATE customer_order SET total_idr=1","UPDATE customer_order SET public_reference='LB-AAAAAAAAAA'","UPDATE customer_order SET state='completed'","UPDATE customer_order SET access_expires_at=access_expires_at+interval '1 hour'"])
      await expect(pool.query(query)).rejects.toMatchObject({code:"23514"});
    expect((await pool.query("SELECT count(*) FROM demo_inbox")).rows[0].count).toBe("0");
    expect((await guestOrder(key(value))).paymentStatus).toBe("unpaid");
  });
  it("works without demo configuration but refuses production and cross-origin ordering", async () => {
    const saved={...process.env};
    try {
      process.env.PAYMENTS_MODE="disabled"; delete process.env.DEMO_PAYMENT_SECRET;
      expect((await publicCatalog(courtId)).orderingEnabled).toBe(true);
      const value=input();expect((await createCourtOrder(value)).state).toBe("awaiting_preparation");
      expect((await guestOrder(key(value))).id).toBe(value.id);
      const response=await POST(new Request(`${config.origin}/api/orders/create`,{method:"POST",headers:{origin:"https://evil.example.invalid","content-type":"application/json"},body:JSON.stringify(input())}),{params:Promise.resolve({action:"create"})});
      expect(response.status).toBe(403);
      Object.assign(process.env,{APP_ENV:"production",APP_ORIGIN:"https://erp.example.invalid",DATABASE_URL:`postgresql://runtime:${randomBytes(20).toString("hex")}@db.example.invalid/lisi_production?sslmode=verify-full`});
      await expect(createCourtOrder(input())).rejects.toMatchObject({status:404});
      await expect(guestOrder(key(value))).rejects.toMatchObject({status:404});
    } finally { for(const name of Object.keys(process.env)) if(!(name in saved)) delete process.env[name]; Object.assign(process.env,saved); }
  });
  it("keeps session expiry mandatory, old demo orders unchanged and v2 references distinct", async () => {
    const columns=await pool.query("SELECT table_name,is_nullable FROM information_schema.columns WHERE column_name='expires_at' AND table_schema='public' AND table_name IN ('session','customer_order') ORDER BY table_name");
    expect(columns.rows).toEqual([{table_name:"customer_order",is_nullable:"YES"},{table_name:"session",is_nullable:"NO"}]);
    const legacy=await createOrder({...input(),kind:"pickup",locationId:null,phone:null,locationConfirmed:false});
    expect(legacy).toMatchObject({workflow:"demo",state:"awaiting_payment",reference:null,simulated:true,expiresAt:expect.any(String)});
    const a=await createCourtOrder(input()), b=await createCourtOrder(input());
    expect(a.reference).not.toBe(b.reference);
    expect((await pool.query("SELECT evidence_mode FROM customer_order WHERE id=$1",[legacy.id])).rows[0].evidence_mode).toBe("demo");
  });
});
