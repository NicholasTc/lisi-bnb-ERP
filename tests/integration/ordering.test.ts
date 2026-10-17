import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, resetTestData } from "../database";
import { provisionEmployee } from "../../src/server/provisioning";
import { readConfig } from "../../src/server/config";
import { authRequest } from "../../src/server/auth-http";
import { getPool } from "../../src/server/db/client";
import { createOrder, guestOrder, staffOrder, staffOrders } from "../../src/server/orders";
import { requestFullRefund } from "../../src/server/payment-processing";
import { deliverDemoEvent, issueDemoEvent, processDemoEvidence as processPaymentEvidence, reconcileDemoEvents } from "../../src/server/demo-payments";
import { signDemoEvidence } from "../../src/server/demo-provider";
import { POST as guestHttp } from "../../src/app/api/orders/[action]/route";
import type { DemoPayload, OrderView } from "../../src/ordering/types";
const pool = testPool(), config = readConfig(), password = randomBytes(20).toString("hex");
let owner: Headers, counter: Headers, supervisor: Headers, prep: Headers;
let productId: string, buildingId: string, courtId: string, tableId: string;
const checkout = () => ({ id: randomUUID(), accessKey: randomBytes(32).toString("hex"), customerName: "Test Guest", phone: null, kind: "pickup", locationId: null,
  items: [{ productId, quantity: 2, priceIdr: 17000 }] });
async function login(role: "owner" | "counter" | "supervisor" | "preparation") {
  const email = `${role}@orders.example.invalid`;
  await provisionEmployee(pool, { email, name: role, password, roles: [role] });
  const response = await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin: config.origin, "content-type": "application/json" }, body: JSON.stringify({ email, password }) }));
  expect(response.status).toBe(200);
  return new Headers({ cookie: response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") });
}
const keyFor = (value: ReturnType<typeof checkout>) => ({ id: value.id, accessKey: value.accessKey });
function eventFor(order: OrderView, changes: Partial<DemoPayload> = {}): DemoPayload {
  return { eventId: randomUUID(), orderId: order.id, transactionId: order.demoTransactionId!, flow: "payment", status: "succeeded", amountIdr: order.totalIdr, currency: "IDR", ...changes };
}
beforeEach(async () => {
  await resetTestData(pool);
  owner = await login("owner"); counter = await login("counter"); supervisor = await login("supervisor"); prep = await login("preparation");
  productId = randomUUID(); buildingId = randomUUID(); courtId = randomUUID(); tableId = randomUUID();
  await pool.query("INSERT INTO product (id,name,category,price_idr) VALUES ($1,'Test Coffee','Drinks',17000)", [productId]);
  await pool.query("INSERT INTO building (id,name) VALUES ($1,'Test Hall')", [buildingId]);
  await pool.query("INSERT INTO location (id,building_id,kind,name,table_number) VALUES ($1,$2,'court','Padel 1',null),($3,$2,'table','7',7)", [courtId, buildingId, tableId]);
});
afterAll(async () => { await resetTestData(pool); await pool.end(); await getPool().end(); });
describe("transactional demo checkout and evidence", () => {
  it("creates all service modes with exact frozen snapshots and guest access isolation", async () => {
    const value = checkout(); const original = await createOrder(value);
    expect(original).toMatchObject({ totalIdr: 34000, state: "awaiting_payment", paymentStatus: "unpaid", simulated: true, pickupCode: expect.any(String) });
    const stored = (await pool.query("SELECT access_hash,expires_at-created_at AS window FROM customer_order WHERE id=$1", [value.id])).rows[0];
    expect(stored.access_hash).not.toBe(value.accessKey);
    await expect(guestOrder({ id: value.id, accessKey: randomBytes(32).toString("hex") })).rejects.toMatchObject({ status: 404 });
    await pool.query("UPDATE product SET name='New name',price_idr=20000 WHERE id=$1", [productId]);
    const recovered = await guestOrder(keyFor(value));
    expect(recovered.items[0]).toMatchObject({ name: "Test Coffee", unitPriceIdr: 17000 });
    expect(recovered.totalIdr).toBe(34000);
    const court = await createOrder({ ...checkout(), kind: "court", phone: "+62 812 3456 7890", locationId: courtId, locationConfirmed: true, items: [{ productId, quantity: 1, priceIdr: 20000 }] });
    expect(court.destination).toBe("Test Hall / Padel 1");
    const table = await createOrder({ ...checkout(), kind: "dine_in", locationId: tableId, items: [{ productId, quantity: 1, priceIdr: 20000 }] });
    expect(table.destination).toBe("Test Hall / Table 7");
  });
  it("repeated/concurrent checkout commits one order and refuses changed retry input", async () => {
    const value = checkout();
    const [a,b] = await Promise.all([createOrder(value), createOrder(value)]);
    expect(a.id).toBe(b.id); expect(a.pickupCode).toBe(b.pickupCode);
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("1");
    expect((await pool.query("SELECT count(*) FROM order_event WHERE kind='created'")).rows[0].count).toBe("1");
    await expect(createOrder({ ...value, customerName: "Changed" })).rejects.toMatchObject({ code: "CHECKOUT_ID_REUSED" });
    await pool.query("UPDATE product SET available=false");
    expect((await createOrder(value)).id).toBe(value.id);
  });
  it("rejects stale prices, invalid destinations, unavailable and free items before recording an order", async () => {
    await expect(createOrder({ ...checkout(), items: [{ productId, quantity: 1, priceIdr: 1 }] })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    await expect(createOrder({ ...checkout(), kind: "dine_in", locationId: courtId })).rejects.toMatchObject({ code: "LOCATION_UNAVAILABLE" });
    await pool.query("UPDATE building SET active=false");
    await expect(createOrder({ ...checkout(), kind: "court", locationId: courtId, phone: "081234567890", locationConfirmed: true })).rejects.toMatchObject({ code: "LOCATION_UNAVAILABLE" });
    await pool.query("UPDATE product SET available=false");
    await expect(createOrder(checkout())).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
  });
  it("requires real employee permission for counter entry, review and another employee's orders", async () => {
    const value = checkout(); const order = await createOrder(value, counter);
    expect(order.source).toBe("counter");
    expect((await staffOrder(counter, { id: order.id })).id).toBe(order.id);
    await expect(createOrder(checkout(), prep)).rejects.toMatchObject({ status: 403 });
    await expect(staffOrder(prep, { id: order.id })).rejects.toMatchObject({ status: 403 });
    await expect(staffOrders(counter, null)).rejects.toMatchObject({ status: 403 });
    await expect(issueDemoEvent(counter, { payload: eventFor(order), deliver: true })).rejects.toMatchObject({ status: 403 });
    expect((await staffOrder(counter, { id: order.id, reason: "Customer changed mind" }, true)).state).toBe("canceled");
    expect((await staffOrders(owner, null)).orders).toHaveLength(1);
    expect((await staffOrder(supervisor, { id: order.id })).source).toBe("counter");
  });
  it("requires trusted evidence and accepts a payment once despite repeated/out-of-order notifications", async () => {
    const value = checkout(), order = await createOrder(value), payload = eventFor(order);
    const signed = signDemoEvidence(payload);
    await expect(processPaymentEvidence({ ...signed, signature: "0".repeat(64) })).rejects.toMatchObject({ code: "UNTRUSTED_PAYMENT_EVIDENCE" });
    await expect(processPaymentEvidence({ ...signed, payload: { ...payload, amountIdr: 1 } })).rejects.toMatchObject({ status: 403 });
    const results = await Promise.all([issueDemoEvent(owner, { payload, deliver: true }), issueDemoEvent(owner, { payload, deliver: true })]);
    expect(results.map(result => result.result)).toEqual(["accepted_for_preparation", "accepted_for_preparation"]);
    await issueDemoEvent(owner, { payload: eventFor(order, { status: "failed" }), deliver: true });
    await issueDemoEvent(owner, { payload: eventFor(order, { status: "expired" }), deliver: true });
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "queued_for_preparation", paymentStatus: "simulated_paid", receivedIdr: "34000" });
    expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("1");
  });
  it("persists withheld provider evidence and safely reconciles missing/delayed delivery", async () => {
    const value = checkout(), order = await createOrder(value), payload = eventFor(order);
    await issueDemoEvent(owner, { payload, deliver: false });
    expect((await guestOrder(keyFor(value))).paymentStatus).toBe("unpaid");
    expect((await staffOrder(owner, { id: order.id })).inbox[0].result).toBeNull();
    expect((await reconcileDemoEvents(owner)).processed).toBe(1);
    expect((await reconcileDemoEvents(owner)).processed).toBe(0);
    expect((await deliverDemoEvent(owner, payload.eventId)).repeated).toBe(true);
  });
  it("holds late success after cancellation or expiry instead of releasing preparation", async () => {
    for (const expired of [false, true]) {
      const value = checkout(), order = await createOrder(value);
      if (expired) {
        await pool.query("UPDATE customer_order SET expires_at=created_at+interval '1 millisecond' WHERE id=$1", [order.id]);
        await new Promise(resolve => setTimeout(resolve, 5));
      } else await guestOrder(keyFor(value), true);
      await issueDemoEvent(owner, { payload: eventFor(order), deliver: true });
      expect(await guestOrder(keyFor(value))).toMatchObject({ state: "exception", paymentStatus: "review", receivedIdr: "34000" });
      expect((await pool.query("SELECT count(*) FROM payment_transaction WHERE order_id=$1 AND is_primary", [order.id])).rows[0].count).toBe("0");
    }
  });
  it("rechecks pending availability and destination, without rewriting already accepted paid orders", async () => {
    const value = checkout(), order = await createOrder(value);
    await pool.query("UPDATE product SET available=false");
    await issueDemoEvent(owner, { payload: eventFor(order), deliver: true });
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "exception", reason: "unavailable_after_checkout" });
    await pool.query("UPDATE product SET available=true");
    const next = checkout(), accepted = await createOrder(next);
    await issueDemoEvent(owner, { payload: eventFor(accepted), deliver: true });
    await pool.query("UPDATE product SET available=false");
    expect((await guestOrder(keyFor(next))).state).toBe("queued_for_preparation");
  });
  it("preserves mismatch evidence and cannot reuse a financial transaction across orders", async () => {
    const value = checkout(), order = await createOrder(value);
    await issueDemoEvent(owner, { payload: eventFor(order, { amountIdr: 1000 }), deliver: true });
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "exception", receivedIdr: "1000" });
    const other = checkout(), next = await createOrder(other);
    const rejected = await issueDemoEvent(owner, { payload: eventFor(next, { transactionId: order.demoTransactionId! }), deliver: true });
    expect(rejected.result).toBe("rejected_transaction_identity");
    await issueDemoEvent(owner, { payload: eventFor(next, { currency: "USD" }), deliver: true });
    expect(await guestOrder(keyFor(other))).toMatchObject({ state: "exception", receivedIdr: "0" });
    expect((await pool.query("SELECT count(*) FROM financial_event")).rows[0].count).toBe("3");
  });
  it("handles actual extra payments separately and refunds only the extra without canceling the valid order", async () => {
    const value = checkout(), order = await createOrder(value);
    await issueDemoEvent(owner, { payload: eventFor(order), deliver: true });
    const extraId = randomUUID();
    await issueDemoEvent(owner, { payload: eventFor(order, { transactionId: extraId }), deliver: true });
    const refundId = randomUUID();
    await requestFullRefund(owner, { id: refundId, orderId: order.id, paymentId: extraId, reason: "Extra payment" });
    await issueDemoEvent(owner, { payload: eventFor(order, { transactionId: refundId, flow: "refund" }), deliver: true });
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "queued_for_preparation", receivedIdr: "68000", refundedIdr: "34000", paymentStatus: "simulated_paid" });
  });
  it("serializes full refunds, preserves unknown outcomes and rejects excessive or regressing results", async () => {
    const value = checkout(), order = await createOrder(value);
    await issueDemoEvent(owner, { payload: eventFor(order), deliver: true });
    await expect(guestOrder(keyFor(value), true)).rejects.toMatchObject({ status: 409 });
    const request = { id: randomUUID(), orderId: order.id, paymentId: order.demoTransactionId, reason: "Customer cancellation" };
    await expect(requestFullRefund(counter, request)).rejects.toMatchObject({ status: 403 });
    const results = await Promise.allSettled([requestFullRefund(owner, request), requestFullRefund(supervisor, { ...request, id: randomUUID() })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const pending = (await guestOrder(keyFor(value))).payments[0].refunds[0];
    await issueDemoEvent(owner, { payload: eventFor(order, { flow: "refund", transactionId: pending.id, status: "pending" }), deliver: true });
    await expect(requestFullRefund(owner, { ...request, id: randomUUID() })).rejects.toMatchObject({ code: "REFUND_ALREADY_REQUESTED" });
    const resultEvent = eventFor(order, { flow: "refund", transactionId: pending.id });
    await issueDemoEvent(owner, { payload: resultEvent, deliver: true });
    await issueDemoEvent(owner, { payload: resultEvent, deliver: true });
    await issueDemoEvent(owner, { payload: eventFor(order, { flow: "refund", transactionId: pending.id, status: "failed" }), deliver: true });
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "canceled", paymentStatus: "refunded", refundedIdr: "34000" });
    await expect(pool.query("UPDATE refund SET amount_idr=1")).rejects.toMatchObject({ code: "23514" });
  });
  it("atomic success/cancel races never duplicate release or lose accepted funds", async () => {
    const value = checkout(), order = await createOrder(value);
    const results = await Promise.allSettled([guestOrder(keyFor(value), true), issueDemoEvent(owner, { payload: eventFor(order), deliver: true })]);
    expect(results.filter(result => result.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const final = await guestOrder(keyFor(value));
    expect(["queued_for_preparation", "exception"]).toContain(final.state);
    expect(final.receivedIdr).toBe("34000"); expect(final.payments).toHaveLength(1);
  });
  it("database guards reject rewritten snapshots, invalid totals, unsupported preparation and extended access", async () => {
    const value = checkout(), order = await createOrder(value);
    for (const query of ["UPDATE customer_order SET total_idr=1", "UPDATE order_item SET quantity=1", "UPDATE customer_order SET state='queued_for_preparation'", "UPDATE customer_order SET access_expires_at=access_expires_at+interval '1 hour'"]) {
      await expect(pool.query(query)).rejects.toMatchObject({ code: "23514" });
    }
    await pool.query("UPDATE customer_order SET access_expires_at=created_at+interval '1 millisecond' WHERE id=$1", [order.id]);
    await new Promise(resolve => setTimeout(resolve, 5));
    await expect(guestOrder(keyFor(value))).rejects.toMatchObject({ status: 404 });
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("1");
    await expect(pool.query("DELETE FROM order_item WHERE order_id=$1", [order.id])).rejects.toMatchObject({ code: "23514" });
  });
  it("recovers an interrupted financial commit from its durable provider inbox", async () => {
    const value = checkout(), order = await createOrder(value), payload = eventFor(order);
    await pool.query("CREATE FUNCTION test_reject_financial_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$");
    await pool.query("CREATE TRIGGER test_financial_commit_failure BEFORE INSERT ON financial_event FOR EACH ROW EXECUTE FUNCTION test_reject_financial_event()");
    try {
      await expect(issueDemoEvent(owner, { payload, deliver: true })).rejects.toBeDefined();
      expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");
      expect((await pool.query("SELECT state FROM customer_order")).rows[0].state).toBe("awaiting_payment");
      expect((await pool.query("SELECT count(*) FROM demo_inbox")).rows[0].count).toBe("1");
    } finally {
      await pool.query("DROP TRIGGER test_financial_commit_failure ON financial_event");
      await pool.query("DROP FUNCTION test_reject_financial_event()");
    }
    await reconcileDemoEvents(owner);
    expect(await guestOrder(keyFor(value))).toMatchObject({ state: "queued_for_preparation", receivedIdr: "34000" });
  });
  it("counts rejected lookup/checkout attempts in persistent throttling", async () => {
    for (let index = 0; index < 30; index++) {
      await expect(createOrder({ ...checkout(), items: [{ productId, quantity: 1, priceIdr: 1 }] })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    }
    await expect(createOrder(checkout())).rejects.toMatchObject({ status: 429 });
    await expect(guestOrder({ id: randomUUID(), accessKey: randomBytes(32).toString("hex") })).rejects.toMatchObject({ status: 404 });
    expect((await pool.query("SELECT count FROM rate_limit WHERE key='orders:guest-access'")).rows[0].count).toBe(1);
    expect((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count).toBe("0");
  });
  it("allows a new refund only after confirmed failure, and ignores contradictory old results", async () => {
    const value = checkout(), order = await createOrder(value);
    await issueDemoEvent(owner, { payload: eventFor(order), deliver: true });
    const request = { id: randomUUID(), orderId: order.id, paymentId: order.demoTransactionId, reason: "Canceled" };
    await requestFullRefund(owner, request);
    await issueDemoEvent(owner, { payload: eventFor(order, { flow: "refund", transactionId: request.id, status: "failed" }), deliver: true });
    const retry = { ...request, id: randomUUID() };
    await requestFullRefund(owner, retry);
    await issueDemoEvent(owner, { payload: eventFor(order, { flow: "refund", transactionId: request.id }), deliver: true });
    expect((await guestOrder(keyFor(value))).refundedIdr).toBe("0");
    await issueDemoEvent(owner, { payload: eventFor(order, { flow: "refund", transactionId: retry.id }), deliver: true });
    expect((await guestOrder(keyFor(value))).refundedIdr).toBe("34000");
    expect((await requestFullRefund(owner, retry)).repeated).toBe(true);
  });
  it("origin/forged client success and production mode fail closed before financial operations", async () => {
    const body = checkout();
    const response = await guestHttp(new Request(`${config.origin}/api/orders/create`, { method: "POST", headers: { origin: "https://evil.example.invalid", "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ action: "create" }) });
    expect(response.status).toBe(403);
    await expect(createOrder({ ...body, paid: true })).rejects.toMatchObject({ status: 400 });
    const saved = { APP_ENV: process.env.APP_ENV, APP_ORIGIN: process.env.APP_ORIGIN, DATABASE_URL: process.env.DATABASE_URL, PAYMENTS_MODE: process.env.PAYMENTS_MODE };
    try {
      Object.assign(process.env, { APP_ENV: "production", APP_ORIGIN: "https://erp.example.invalid", DATABASE_URL: `postgresql://runtime:${password}@db.example.invalid/lisi_production?sslmode=verify-full`, PAYMENTS_MODE: "disabled" });
      await expect(createOrder(body)).rejects.toMatchObject({ status: 404 });
      await expect(guestOrder(keyFor(body))).rejects.toMatchObject({ status: 404 });
      await expect(reconcileDemoEvents(owner)).rejects.toMatchObject({ status: 404 });
    } finally { Object.assign(process.env, saved); }
  });
});
