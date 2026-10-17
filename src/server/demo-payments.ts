import "server-only";
import { getPool } from "./db/client";
import { HttpError } from "./http";
import { checkKeys, idField } from "./catalog-input";
import { demoInput } from "../ordering/input";
import { signDemoEvidence, verifyDemoEvidence, type DemoEvidence } from "./demo-provider";
import { digest, orderEmployee, orderLock, requireDemo, transaction } from "./order-db";
import { processVerifiedPaymentEvidence } from "./payment-processing";
import type { DemoPayload } from "../ordering/types";

export async function processDemoEvidence(evidence: DemoEvidence) {
  return processVerifiedPaymentEvidence(verifyDemoEvidence(evidence));
}
export async function issueDemoEvent(headers: Headers, raw: Record<string, unknown>) {
  requireDemo();
  const who = await orderEmployee(headers, "review", true);
  checkKeys(raw, ["payload", "deliver"]);
  if (!raw.payload || typeof raw.payload !== "object" || Array.isArray(raw.payload) || typeof raw.deliver !== "boolean") throw new HttpError(400, "INVALID_INPUT");
  const payload = demoInput(raw.payload as Record<string, unknown>), signed = signDemoEvidence(payload);
  const fingerprint = digest(JSON.stringify(payload));
  const saved = await transaction(async client => {
    const order = await orderLock(client, payload.orderId);
    if (order.evidence_mode !== "demo") throw new HttpError(409, "COURT_PAYMENT_VERIFICATION_UNAVAILABLE");
    const existing = (await client.query<{ payload: DemoPayload; signature: string; digest: string }>("SELECT payload,signature,digest FROM demo_inbox WHERE id=$1", [payload.eventId])).rows[0];
    if (existing) {
      if (existing.digest !== fingerprint) throw new HttpError(409, "EVENT_ID_REUSED");
      return { payload: existing.payload, signature: existing.signature };
    }
    if (payload.flow === "refund" && !(await client.query("SELECT 1 FROM refund WHERE id=$1 AND order_id=$2", [payload.transactionId, payload.orderId])).rowCount) throw new HttpError(404, "REFUND_NOT_FOUND");
    await client.query("INSERT INTO demo_inbox (id,order_id,digest,payload,signature,actor_id) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",
      [payload.eventId, payload.orderId, fingerprint, JSON.stringify(signed.payload), signed.signature, who.user.id]);
    return signed;
  });
  return raw.deliver ? processDemoEvidence(saved) : { result: "stored_not_delivered", repeated: false };
}
export async function deliverDemoEvent(headers: Headers, eventId: unknown) {
  requireDemo(); await orderEmployee(headers, "review", true);
  const row = (await getPool().query<DemoEvidence>("SELECT payload,signature FROM demo_inbox WHERE id=$1", [idField(eventId)])).rows[0];
  if (!row) throw new HttpError(404, "EVENT_NOT_FOUND");
  return processDemoEvidence(row);
}
export async function reconcileDemoEvents(headers: Headers) {
  requireDemo(); await orderEmployee(headers, "review", true);
  const pending = await getPool().query<DemoEvidence>("SELECT i.payload,i.signature FROM demo_inbox i LEFT JOIN financial_event f ON f.id=i.id WHERE f.id IS NULL ORDER BY i.created_at,i.id LIMIT 50");
  const results = [];
  for (const event of pending.rows) results.push(await processDemoEvidence(event));
  return { processed: results.length, results };
}
