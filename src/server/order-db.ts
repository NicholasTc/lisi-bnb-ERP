import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db/client";
import { readConfig } from "./config";
import { requireEmployee } from "./employee";
import { HttpError } from "./http";
import type { OrderState, ServiceMode } from "../ordering/types";
import { assertVerifiedEvidence, type VerifiedEvidence } from "./verified-evidence";
export type OrderRow = {
  id: string; request_digest: string; access_hash: string; source: "guest" | "counter"; created_by: string | null;
  customer_name: string; phone: string | null; kind: ServiceMode; location_id: string | null; destination: string; total_idr: number;
  state: OrderState; reason: string | null; demo_transaction_id: string | null; public_reference: string | null; pickup_code: string | null;
  created_at: Date; expires_at: Date | null; access_expires_at: Date; evidence_mode: string;
};
export function requireDemo() {
  const config = readConfig();
  if (config.environment === "production") throw new HttpError(404, "DEMO_UNAVAILABLE");
  if (config.paymentsMode !== "demo" || !config.demoSecret) throw new HttpError(503, "DEMO_DISABLED");
  return config;
}
// Court checkout is independent of the historical payment simulator. Production stays closed.
export function requireOrdering() {
  const config = readConfig();
  if (config.environment === "production") throw new HttpError(404, "ORDERING_UNAVAILABLE");
  return config;
}
export function requireSupportedEvidence(value: VerifiedEvidence) {
  requireDemo(); assertVerifiedEvidence(value);
  if (value.provider !== "demo" || !value.simulated) throw new HttpError(403, "UNSUPPORTED_PAYMENT_PROVIDER");
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try { await client.query("BEGIN"); const value = await run(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function orderLock(client: PoolClient, id: string) {
  requireOrdering();
  const result = await client.query<OrderRow>("SELECT * FROM customer_order WHERE id = $1 FOR UPDATE", [id]);
  if (!result.rowCount) throw new HttpError(404, "ORDER_NOT_FOUND");
  return result.rows[0];
}
export async function orderAudit(client: PoolClient, orderId: string, kind: string, detail: string, actorId: string | null = null) {
  await client.query("INSERT INTO order_event (id, order_id, actor_id, kind, detail) VALUES ($1,$2,$3,$4,$5)", [randomUUID(), orderId, actorId, kind, detail]);
}
export async function expireOrder(client: PoolClient, order: OrderRow) {
  if (order.evidence_mode !== "demo") return;
  const changed = await client.query("UPDATE customer_order SET state='canceled', reason='expired' WHERE id=$1 AND state='awaiting_payment' AND expires_at <= clock_timestamp() RETURNING id", [order.id]);
  if (changed.rowCount) { order.state = "canceled"; order.reason = "expired"; await orderAudit(client, order.id, "expired", "payment_window_elapsed"); }
}
export async function orderEmployee(headers: Headers, permission: "counter" | "review", activity = false) {
  requireOrdering();
  const who = await requireEmployee(headers, activity);
  const allowed = permission === "counter" ? ["owner", "counter"] : ["owner", "supervisor"];
  if (!who.roles.some(role => allowed.includes(role))) throw new HttpError(403, "FORBIDDEN");
  return who;
}
export async function throttle(client: PoolClient, key: string, maximum: number) {
  const result = await client.query(`INSERT INTO rate_limit (id,key,count,last_request)
    VALUES ($1,$2,1,(extract(epoch from clock_timestamp())*1000)::bigint)
    ON CONFLICT (key) DO UPDATE SET count = CASE WHEN rate_limit.last_request <= (extract(epoch from clock_timestamp())*1000)::bigint - 60000 THEN 1 ELSE rate_limit.count+1 END,
    last_request = CASE WHEN rate_limit.last_request <= (extract(epoch from clock_timestamp())*1000)::bigint - 60000 THEN (extract(epoch from clock_timestamp())*1000)::bigint ELSE rate_limit.last_request END
    WHERE rate_limit.count < $3 OR rate_limit.last_request <= (extract(epoch from clock_timestamp())*1000)::bigint - 60000 RETURNING id`, [randomUUID(), `orders:${key}`, maximum]);
  if (!result.rowCount) throw new HttpError(429, "TOO_MANY_REQUESTS");
}
export async function availableDestination(client: PoolClient, locationId: string, kind: ServiceMode) {
  const row = (await client.query<{ name: string; building_name: string; kind: string }>(`SELECT l.name, b.name AS building_name, l.kind
    FROM location l JOIN building b ON b.id = l.building_id WHERE l.id=$1 AND l.active AND b.active FOR SHARE OF l,b`, [locationId])).rows[0];
  if (!row || row.kind !== (kind === "court" ? "court" : "table")) throw new HttpError(409, "LOCATION_UNAVAILABLE");
  return `${row.building_name} / ${row.kind === "table" ? `Table ${row.name}` : row.name}`;
}
