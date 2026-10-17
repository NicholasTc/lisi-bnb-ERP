import "server-only";
import type { PoolClient } from "pg";
import { HttpError } from "./http";
import { checkKeys, idField, textField } from "./catalog-input";
import { availableDestination, digest, expireOrder, orderAudit, orderEmployee, orderLock, requireSupportedEvidence, transaction, type OrderRow } from "./order-db";
import type { PaymentEvent } from "../ordering/types";
import type { VerifiedEvidence } from "./verified-evidence";

type PaymentRow = { id: string; order_id: string; amount_idr: number; currency: string; matched: boolean; is_primary: boolean };
type RefundRow = { id: string; order_id: string; payment_id: string; amount_idr: number; state: string; reason: string };
async function fulfillmentAvailable(client: PoolClient, order: OrderRow) {
  const items = await client.query<{ available: boolean; active: boolean }>(`SELECT p.available,p.active FROM product p JOIN order_item i ON i.product_id=p.id WHERE i.order_id=$1 ORDER BY p.id FOR SHARE OF p`, [order.id]);
  if (!items.rowCount || items.rows.some(item => !item.available || !item.active)) return false;
  if (order.location_id) {
    try { await availableDestination(client, order.location_id, order.kind); }
    catch (error) { if (error instanceof HttpError && error.code === "LOCATION_UNAVAILABLE") return false; throw error; }
  }
  return true;
}
async function setState(client: PoolClient, order: OrderRow, state: OrderRow["state"], reason: string | null) {
  await client.query("UPDATE customer_order SET state=$2,reason=$3 WHERE id=$1", [order.id, state, reason]);
  order.state = state; order.reason = reason;
}
async function processPayment(client: PoolClient, order: OrderRow, event: PaymentEvent) {
  if (event.status === "pending") return "pending";
  if (event.status === "failed" || event.status === "expired") {
    if (order.state === "awaiting_payment" && event.transactionId === order.demo_transaction_id) {
      await setState(client, order, "canceled", event.status === "failed" ? "payment_failed" : "provider_expired");
      return "closed_unpaid";
    }
    return "ignored_no_regression";
  }
  const existing = (await client.query<PaymentRow>("SELECT * FROM payment_transaction WHERE id=$1", [event.transactionId])).rows[0];
  if (existing) return existing.order_id === order.id && existing.amount_idr === event.amountIdr && existing.currency === event.currency ? "duplicate_payment" : "rejected_transaction_identity";
  const hasPrimary = !!(await client.query("SELECT 1 FROM payment_transaction WHERE order_id=$1 AND is_primary", [order.id])).rowCount;
  if (event.currency !== "IDR" || event.amountIdr <= 0) {
    if (!hasPrimary && order.state === "awaiting_payment") await setState(client, order, "exception", "payment_mismatch");
    return "rejected_currency_or_amount";
  }
  const matched = event.amountIdr === order.total_idr;
  const available = matched && order.state === "awaiting_payment" && await fulfillmentAvailable(client, order);
  // Re-evaluate database time after any row-lock waits.
  await expireOrder(client, order);
  const primary = matched && available && order.state === "awaiting_payment" && !hasPrimary;
  const inserted = await client.query(`INSERT INTO payment_transaction (id,order_id,amount_idr,currency,matched,is_primary)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [event.transactionId, order.id, event.amountIdr, event.currency, matched, primary]);
  if (!inserted.rowCount) return "rejected_transaction_identity";
  if (primary) { await setState(client, order, "queued_for_preparation", null); return "accepted_for_preparation"; }
  if (order.state !== "queued_for_preparation") await setState(client, order, "exception", !matched ? "payment_mismatch" : !available && order.state === "awaiting_payment" ? "unavailable_after_checkout" : "late_payment");
  return matched ? hasPrimary ? "extra_payment_review" : "payment_review_refund_default" : "mismatched_payment_review";
}
async function processRefund(client: PoolClient, order: OrderRow, event: PaymentEvent) {
  const row = (await client.query<RefundRow>("SELECT * FROM refund WHERE id=$1 FOR UPDATE", [event.transactionId])).rows[0];
  if (!row || row.order_id !== order.id || row.amount_idr !== event.amountIdr || event.currency !== "IDR") return "rejected_refund_identity";
  if (event.status === "pending") return "refund_unknown_pending";
  if (row.state !== "pending") return row.state === event.status ? "duplicate_refund_result" : "ignored_no_regression";
  if (event.status !== "succeeded" && event.status !== "failed") return "rejected_refund_status";
  await client.query("UPDATE refund SET state=$2 WHERE id=$1", [row.id, event.status]);
  if (event.status === "succeeded" && order.state === "exception") {
    const remaining = await client.query(`SELECT 1 FROM payment_transaction p WHERE p.order_id=$1 AND NOT EXISTS (SELECT 1 FROM refund r WHERE r.payment_id=p.id AND r.state='succeeded') LIMIT 1`, [order.id]);
    if (!remaining.rowCount) await setState(client, order, "canceled", "refunded");
  }
  return `refund_${event.status}`;
}

/** Shared business processing. HTTP input cannot manufacture the server-only verification marker. */
export async function processVerifiedPaymentEvidence(evidence: VerifiedEvidence) {
  requireSupportedEvidence(evidence);
  const event = evidence.payload;
  const fingerprint = digest(JSON.stringify(event));
  return transaction(async client => {
    const order = await orderLock(client, event.orderId);
    if (order.evidence_mode !== "demo") throw new HttpError(409, "COURT_PAYMENT_VERIFICATION_UNAVAILABLE");
    const previous = (await client.query<{ digest: string; result: string }>("SELECT digest,result FROM financial_event WHERE id=$1", [event.eventId])).rows[0];
    if (previous) {
      if (previous.digest !== fingerprint) throw new HttpError(409, "EVENT_ID_REUSED");
      return { result: previous.result, repeated: true };
    }
    await expireOrder(client, order);
    const result = event.flow === "payment" ? await processPayment(client, order, event) : await processRefund(client, order, event);
    await client.query("INSERT INTO financial_event (id,order_id,digest,payload,result) VALUES ($1,$2,$3,$4::jsonb,$5)", [event.eventId, order.id, fingerprint, JSON.stringify({ ...event, provider: evidence.provider, simulated: evidence.simulated }), result]);
    return { result, repeated: false };
  });
}
export async function requestFullRefund(headers: Headers, raw: Record<string, unknown>) {
  const who = await orderEmployee(headers, "review", true);
  checkKeys(raw, ["id", "orderId", "paymentId", "reason"]);
  const id = idField(raw.id), orderId = idField(raw.orderId), paymentId = idField(raw.paymentId), reason = textField(raw, "reason", 200);
  return transaction(async client => {
    const order = await orderLock(client, orderId);
    if (order.evidence_mode !== "demo") throw new HttpError(409, "COURT_PAYMENT_VERIFICATION_UNAVAILABLE");
    const previous = (await client.query<RefundRow>("SELECT * FROM refund WHERE id=$1", [id])).rows[0];
    if (previous) {
      if (previous.order_id !== orderId || previous.payment_id !== paymentId || previous.reason !== reason) throw new HttpError(409, "REFUND_ID_REUSED");
      return { id: previous.id, state: previous.state, repeated: true };
    }
    const paid = (await client.query<PaymentRow>("SELECT * FROM payment_transaction WHERE id=$1 AND order_id=$2 FOR UPDATE", [paymentId, orderId])).rows[0];
    if (!paid) throw new HttpError(404, "PAYMENT_NOT_FOUND");
    if ((await client.query("SELECT 1 FROM refund WHERE payment_id=$1 AND state IN ('pending','succeeded')", [paymentId])).rowCount) throw new HttpError(409, "REFUND_ALREADY_REQUESTED");
    await client.query("INSERT INTO refund (id,order_id,payment_id,amount_idr,reason,actor_id) VALUES ($1,$2,$3,$4,$5,$6)", [id, orderId, paymentId, paid.amount_idr, reason, who.user.id]);
    if (paid.is_primary) await setState(client, order, "canceled", "refund_requested");
    await orderAudit(client, orderId, "refund_requested", reason, who.user.id);
    return { id, state: "pending", repeated: false };
  });
}
