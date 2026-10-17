import "server-only";
import type { PoolClient } from "pg";
import { lockEmployee, requireEmployee } from "./employee";
import { HttpError } from "./http";
import { digest, orderLock, requireOrdering, transaction } from "./order-db";
import { idField } from "./catalog-input";
import { preparationInput, preparationState } from "./preparation-input";
import { preparationStates, type PreparationQueue } from "../preparation/types";

type Employee = Awaited<ReturnType<typeof requireEmployee>>;
// Recheck session and current permissions inside the same transaction as the action.
// Locks serialize disabling, logout and role removal against an authorized action.
async function authorize(client: PoolClient, who: Employee, work: boolean) {
  const roles = await lockEmployee(client, who, work ? ["preparation", "owner"] : ["preparation", "owner", "supervisor"]);
  const canWork = roles.includes("preparation") || roles.includes("owner");
  return {canWork,canDeliver:roles.includes("owner")||roles.includes("delivery"),canManageAccounts:roles.includes("owner")};
}
export async function preparationQueue(headers: Headers, state: unknown = "awaiting_preparation", after: string | null = null): Promise<PreparationQueue> {
  requireOrdering(); const tab = preparationState(state), cursor = after ? idField(after) : null;
  const who = await requireEmployee(headers);
  return transaction(async client => {
    const capabilities = await authorize(client, who, false);
    const service = (await client.query<PreparationQueue["service"]>('SELECT paused,reason,version,delivery_paused AS "deliveryPaused" FROM court_service WHERE id=1 FOR SHARE')).rows[0];
    if (!service) throw new HttpError(503, "NOT_READY");
    // One statement gives counts and the bounded page the same database snapshot.
    const result = await client.query<{ latest: string | null; counts: PreparationQueue["counts"]; orders: PreparationQueue["orders"] }>(`
      WITH eligible AS MATERIALIZED (SELECT * FROM customer_order WHERE evidence_mode='court_test' AND (state<>'exception' OR coalesce(held_state,CASE WHEN preparation_assignee_id IS NULL THEN 'awaiting_preparation' ELSE 'preparing' END) IN ('awaiting_preparation','preparing'))),
      page AS (SELECT o.* FROM eligible o WHERE state=$1 AND ($2::text IS NULL OR
        (created_at,id) > (SELECT created_at,id FROM eligible WHERE id=$2)) ORDER BY created_at,id LIMIT 51)
      SELECT (SELECT id FROM eligible ORDER BY created_at DESC,id DESC LIMIT 1) AS latest,
      (SELECT jsonb_object_agg(state,n) FROM (SELECT state,count(*)::int n FROM eligible GROUP BY state) c) AS counts,
      (SELECT coalesce(jsonb_agg(entry ORDER BY created_at,id),'[]'::jsonb) FROM (
        SELECT p.created_at,p.id,jsonb_build_object('id',p.id,'reference',p.public_reference,'customerName',p.customer_name,
          'destination',coalesce(p.effective_destination,p.destination),'state',p.state,'createdAt',p.created_at,'assigneeId',p.preparation_assignee_id,
          'assigneeName',u.name,'claimedAt',p.preparation_claimed_at,'readyAt',p.preparation_ready_at,'reason',p.reason,
          'items',(SELECT jsonb_agg(jsonb_build_object('name',i.name,'nameEn',i.name_en,'quantity',i.quantity) ORDER BY i.product_id)
            FROM order_item i WHERE i.order_id=p.id)) AS entry
          FROM page p LEFT JOIN "user" u ON u.id=p.preparation_assignee_id) entries) AS orders`, [tab, cursor]);
    const value = result.rows[0], orders = value.orders.slice(0, 50);
    return { latestOrderId: value.latest, employee: { id: who.user.id, name: who.user.name, ...capabilities }, service,
      counts: Object.fromEntries(preparationStates.map(state => [state, value.counts?.[state] ?? 0])) as PreparationQueue["counts"],
      orders, next: value.orders.length > 50 ? orders.at(-1)!.id : null };
  });
}
export async function preparationAction(headers: Headers, raw: Record<string, unknown>) {
  requireOrdering(); const who = await requireEmployee(headers, true), input = preparationInput(raw);
  const hash = digest(JSON.stringify({ actor: who.user.id, ...input }));
  return transaction(async client => {
    await authorize(client, who, true);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`preparation:${input.id}`]);
    const previous = (await client.query<{ digest: string }>("SELECT digest FROM preparation_command WHERE id=$1", [input.id])).rows[0];
    if (previous) {
      if (previous.digest !== hash) throw new HttpError(409, "COMMAND_ID_REUSED");
      return { accepted: true, replayed: true };
    }
    let version: number | null = null;
    if (input.kind === "pause" || input.kind === "resume") {
      const control = (await client.query<{ version: number; paused: boolean }>("SELECT version,paused FROM court_service WHERE id=1 FOR UPDATE")).rows[0];
      if (!control) throw new HttpError(503, "NOT_READY");
      if (control.version !== input.version || control.paused === (input.kind === "pause")) throw new HttpError(409, "SERVICE_CHANGED");
      version = control.version + 1;
      await client.query("UPDATE court_service SET paused=$1,reason=$2,version=$3,actor_id=$4,updated_at=clock_timestamp() WHERE id=1",
        [input.kind === "pause", input.reason ?? null, version, who.user.id]);
    } else {
      const order = await orderLock(client, input.orderId!);
      if (order.evidence_mode !== "court_test") throw new HttpError(409, "COURT_ONLY");
      if (input.kind === "claim") {
        if (order.state !== "awaiting_preparation") throw new HttpError(409, "TASK_CHANGED");
        await client.query("UPDATE customer_order SET state='preparing',preparation_assignee_id=$2,preparation_claimed_at=clock_timestamp() WHERE id=$1", [order.id, who.user.id]);
      } else {
        const assigned = (await client.query<{ preparation_assignee_id: string | null }>("SELECT preparation_assignee_id FROM customer_order WHERE id=$1", [order.id])).rows[0];
        if (order.state !== "preparing" && !(input.kind === "hold" && order.state === "awaiting_preparation")) throw new HttpError(409, "TASK_CHANGED");
        if (assigned.preparation_assignee_id && assigned.preparation_assignee_id !== who.user.id) throw new HttpError(403, "NOT_ASSIGNEE");
        if (input.kind === "ready") await client.query("UPDATE customer_order SET state='ready',preparation_ready_at=clock_timestamp() WHERE id=$1", [order.id]);
        else await client.query("UPDATE customer_order SET state='exception',reason=$2 WHERE id=$1", [order.id, input.reason]);
      }
      await client.query("INSERT INTO order_event (id,order_id,actor_id,kind,detail) VALUES ($1,$2,$3,$4,$5)",
        [input.id, order.id, who.user.id, `preparation_${input.kind}`, input.reason ?? input.kind]);
    }
    const orderVersion=input.orderId?(await client.query("SELECT operation_version FROM customer_order WHERE id=$1",[input.orderId])).rows[0].operation_version:null;
    await client.query("INSERT INTO preparation_command (id,actor_id,order_id,kind,digest,reason,service_version,order_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [input.id, who.user.id, input.orderId ?? null, input.kind, hash, input.reason ?? null, version,orderVersion]);
    return { accepted: true, replayed: false };
  });
}
