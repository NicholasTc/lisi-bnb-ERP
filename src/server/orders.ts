import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db/client";
import { requireEmployee } from "./employee";
import { HttpError } from "./http";
import { accessKey, checkoutInput, exactTotal } from "../ordering/input";
import { checkKeys, idField, textField } from "./catalog-input";
import { availableDestination, digest, expireOrder, orderAudit, orderEmployee, orderLock, requireOrdering, requireDemo, throttle, transaction, type OrderRow } from "./order-db";
import type { OrderView, StaffOrder } from "../ordering/types";

export async function createCourtOrder(raw: Record<string, unknown>) {
  requireOrdering();
  if (raw.kind !== "court") throw new HttpError(400, "COURT_ONLY");
  return createOrder(raw, undefined, "court_test");
}
// Retained v1 creation is only used by historical fixture/financial regression tests.
export async function createOrder(raw: Record<string, unknown>, headers?: Headers, mode: "demo" | "court_test" = "demo") {
  if (mode === "demo") requireDemo(); else requireOrdering();
  const employee = headers ? await orderEmployee(headers, "counter", true) : null;
  const input = checkoutInput(raw);
  await transaction(client => throttle(client, employee ? `counter:${employee.user.id}` : "guest-create", 30));
  const requestDigest = digest(JSON.stringify({ ...input, accessKey: digest(input.accessKey), actor: employee?.user.id ?? null, mode }));
  return transaction(async client => {
    // Even simultaneous first submissions serialize before an order row exists.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`checkout:${input.id}`]);
    const existing = (await client.query<OrderRow & { access_valid: boolean }>("SELECT *, access_expires_at > clock_timestamp() AS access_valid FROM customer_order WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
    if (existing) {
      if (existing.request_digest !== requestDigest) throw new HttpError(409, "CHECKOUT_ID_REUSED");
      if (!existing.access_valid) throw new HttpError(404, "ORDER_NOT_FOUND");
      return viewOrder(client, existing);
    }
    if (mode === "court_test") {
      const service = (await client.query<{ paused: boolean }>("SELECT (paused OR delivery_paused) AS paused FROM court_service WHERE id=1 FOR SHARE")).rows[0];
      if (!service) throw new HttpError(503, "NOT_READY");
      if (service.paused) throw new HttpError(503, "ORDERING_PAUSED");
    }
    const products = await client.query<{ id: string; name: string; name_en: string | null; description: string; description_en: string | null; price_idr: number; available: boolean; active: boolean }>(
      "SELECT * FROM product WHERE id = ANY($1::text[]) ORDER BY id FOR SHARE", [input.items.map(item => item.productId)]);
    if (products.rowCount !== input.items.length || products.rows.some(item => !item.active || !item.available || item.price_idr <= 0)) throw new HttpError(409, "ITEM_UNAVAILABLE");
    if (products.rows.some(item => input.items.find(line => line.productId === item.id)?.priceIdr !== item.price_idr)) throw new HttpError(409, "PRICE_CHANGED");
    const destination = input.locationId ? await availableDestination(client, input.locationId, input.kind) : "Café pickup";
    const total = exactTotal(input.items.map(line => ({ quantity: line.quantity, unitPriceIdr: products.rows.find(item => item.id === line.productId)!.price_idr })));
    let pickupCode: string | null = null;
    if (input.kind === "pickup") {
      // Transaction-wide serialization makes this small collision check conclusive.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('pickup-code',0))");
      do { pickupCode = randomBytes(5).toString("hex").toUpperCase(); }
      while ((await client.query("SELECT 1 FROM customer_order WHERE pickup_code=$1", [pickupCode])).rowCount);
    }
    let reference: string | null = null;
    if (mode === "court_test") {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('court-reference',0))");
      do { reference = `LB-${randomBytes(5).toString("hex").toUpperCase()}`; }
      while ((await client.query("SELECT 1 FROM customer_order WHERE public_reference=$1", [reference])).rowCount);
    }
    const inserted = await client.query<OrderRow>(`INSERT INTO customer_order
      (id,request_digest,access_hash,source,created_by,customer_name,phone,kind,location_id,destination,total_idr,demo_transaction_id,pickup_code,evidence_mode,expires_at,access_expires_at,public_reference,state)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $14='demo' THEN now()+interval '15 minutes' ELSE NULL END,now()+interval '24 hours',$15,$16) RETURNING *`,
      [input.id, requestDigest, digest(input.accessKey), employee ? "counter" : "guest", employee?.user.id ?? null, input.customerName, input.phone,
        input.kind, input.locationId, destination, total, mode === "demo" ? randomUUID() : null, pickupCode, mode, reference, mode === "court_test" ? "awaiting_preparation" : "awaiting_payment"]);
    for (const line of input.items) {
      const item = products.rows.find(item => item.id === line.productId)!;
      await client.query(`INSERT INTO order_item (order_id,product_id,name,name_en,description,description_en,quantity,unit_price_idr) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [input.id, item.id, item.name, item.name_en, item.description, item.description_en, line.quantity, item.price_idr]);
    }
    await orderAudit(client, input.id, "created", `${employee ? "counter" : "guest"}_${mode}_checkout${input.locationConfirmed ? ":court_confirmed" : ""}`, employee?.user.id);
    return viewOrder(client, inserted.rows[0]);
  });
}
export async function viewOrder(client: PoolClient, order: OrderRow): Promise<OrderView> {
  await expireOrder(client, order);
  const items = (await client.query(`SELECT product_id AS "productId",name,name_en AS "nameEn",description,description_en AS "descriptionEn",quantity,unit_price_idr AS "unitPriceIdr" FROM order_item WHERE order_id=$1 ORDER BY product_id`, [order.id])).rows;
  const paid = (await client.query<{ id: string; amountIdr: number; matched: boolean; primary: boolean }>('SELECT id, amount_idr AS "amountIdr",matched,is_primary AS "primary" FROM payment_transaction WHERE order_id=$1 ORDER BY created_at,id', [order.id])).rows;
  const refunds = (await client.query<{ id: string; payment_id: string; state: "pending" | "succeeded" | "failed"; amountIdr: number }>('SELECT id,payment_id,state,amount_idr AS "amountIdr" FROM refund WHERE order_id=$1 ORDER BY created_at,id', [order.id])).rows;
  const received = paid.reduce((sum, item) => sum + BigInt(item.amountIdr), 0n);
  const refunded = refunds.filter(item => item.state === "succeeded").reduce((sum, item) => sum + BigInt(item.amountIdr), 0n);
  const status = refunds.some(item => item.state === "pending") ? "refund_pending" : received > 0n && received === refunded ? "refunded" :
    order.state === "exception" && order.evidence_mode === "demo" ? "review" : paid.some(item => item.primary) && order.state === "queued_for_preparation" ? "simulated_paid" : received > refunded ? "review" : "unpaid";
  return { id: order.id, source: order.source, customerName: order.customer_name, phone: order.phone, kind: order.kind, destination: order.effective_destination ?? order.destination,
    totalIdr: order.total_idr, state: order.state, reason: order.evidence_mode === "court_test" ? null : order.reason, createdAt: order.created_at.toISOString(), expiresAt: order.expires_at?.toISOString() ?? null,
    accessExpiresAt: order.access_expires_at.toISOString(), demoTransactionId: order.demo_transaction_id, pickupCode: order.pickup_code, simulated: order.evidence_mode === "demo", testOnly: true, reference: order.public_reference, workflow: order.evidence_mode as "demo" | "court_test",
    items, receivedIdr: String(received), refundedIdr: String(refunded), paymentStatus: status,
    payments: paid.map(item => ({ ...item, refunds: refunds.filter(value => value.payment_id === item.id).map(({ id, state, amountIdr }) => ({ id, state, amountIdr })) })) };
}
async function guestLock(client: PoolClient, raw: Record<string, unknown>) {
  checkKeys(raw, ["id", "accessKey"]);
  const id = idField(raw.id), hash = digest(accessKey(raw.accessKey));
  const result = await client.query<OrderRow>("SELECT * FROM customer_order WHERE id=$1 AND access_hash=$2 AND access_expires_at > clock_timestamp() FOR UPDATE", [id, hash]);
  if (!result.rowCount) throw new HttpError(404, "ORDER_NOT_FOUND");
  return result.rows[0];
}
export async function guestOrder(raw: Record<string, unknown>, cancel = false) {
  requireOrdering();
  // Commit abuse accounting independently of rejected lookup attempts.
  await transaction(client => throttle(client, "guest-access", 300));
  return transaction(async client => {
    const order = await guestLock(client, raw);
    if (cancel) await cancelUnpaid(client, order, null, "guest_canceled");
    return viewOrder(client, order);
  });
}
async function cancelUnpaid(client: PoolClient, order: OrderRow, actor: string | null, reason: string) {
  await expireOrder(client, order);
  if (order.state === "canceled") return;
  if (order.state !== (order.evidence_mode === "court_test" ? "awaiting_preparation" : "awaiting_payment")) throw new HttpError(409, order.evidence_mode === "court_test" ? "PREPARATION_ALREADY_STARTED" : "PAID_CANCELLATION_REQUIRES_REVIEW");
  await client.query("UPDATE customer_order SET state='canceled',reason=$2 WHERE id=$1", [order.id, reason]);
  order.state = "canceled"; order.reason = reason;
  await orderAudit(client, order.id, "canceled", reason, actor);
}
export async function staffOrder(headers: Headers, raw: Record<string, unknown>, cancel = false): Promise<StaffOrder> {
  requireOrdering();
  const who = await requireEmployee(headers, cancel);
  checkKeys(raw, cancel ? ["id", "reason"] : ["id"]);
  const id = idField(raw.id);
  const privileged = who.roles.some(role => role === "owner" || role === "supervisor");
  return transaction(async client => {
    const order = await orderLock(client, id);
    if (!privileged && !(who.roles.includes("counter") && order.created_by === who.user.id && order.source === "counter")) throw new HttpError(403, "FORBIDDEN");
    if (cancel && order.evidence_mode === "court_test") throw new HttpError(409,"COURT_USE_OPERATIONS");
    if (cancel) await cancelUnpaid(client, order, who.user.id, textField(raw, "reason", 200));
    const value = await viewOrder(client, order);
    const inbox = privileged ? (await client.query(`SELECT i.id,i.payload,f.result FROM demo_inbox i LEFT JOIN financial_event f ON f.id=i.id WHERE i.order_id=$1 ORDER BY i.created_at,i.id`, [id])).rows : [];
    return { ...value, inbox };
  });
}
export async function staffOrders(headers: Headers, before: string | null) {
  await orderEmployee(headers, "review");
  const cursor = before ? idField(before) : null;
  const rows = await getPool().query(`SELECT id,customer_name AS "customerName",CASE WHEN evidence_mode='demo' AND state='awaiting_payment' AND expires_at <= clock_timestamp() THEN 'canceled' ELSE state END AS state,total_idr AS "totalIdr",created_at AS "createdAt"
    FROM customer_order WHERE evidence_mode='demo' AND ($1::text IS NULL OR (created_at,id) < (SELECT created_at,id FROM customer_order WHERE id=$1))
    ORDER BY created_at DESC,id DESC LIMIT 50`, [cursor]);
  return { orders: rows.rows, next: rows.rows.length === 50 ? rows.rows.at(-1).id : null };
}
