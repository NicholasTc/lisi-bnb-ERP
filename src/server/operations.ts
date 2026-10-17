import "server-only";
import { requireEmployee,lockEmployee } from "./employee";
import { requireOrdering,transaction,orderLock,digest,availableDestination,type OrderRow } from "./order-db";
import { HttpError } from "./http";
import { idField } from "./catalog-input";
import { operationInput,managedActions } from "./operation-input";
import { operationTabs,type OperationTab,type OperationView } from "../operations/types";
const stage=(o:OrderRow)=>o.state==="exception"?o.held_state??(o.preparation_assignee_id?"preparing":"awaiting_preparation"):o.state;
function snapshot(o:OrderRow){return {version:o.operation_version,state:o.state,preparationAssigneeId:o.preparation_assignee_id,deliveryAssigneeId:o.delivery_assignee_id,
 preparationClaimedAt:o.preparation_claimed_at,preparationReadyAt:o.preparation_ready_at,deliveryClaimedAt:o.delivery_claimed_at,heldState:o.held_state,incident:o.incident,contactAttempt:o.contact_attempt,collectedAt:o.collected_at,arrivedAt:o.arrived_at,returnedAt:o.returned_at,
 unpaidHandoverAt:o.unpaid_handover_at,effectiveLocationId:o.effective_location_id,effectiveDestination:o.effective_destination,reason:o.reason,
 preparedUnpaidException:(o.state==="canceled"&&!!o.preparation_ready_at)||o.state==="unpaid_handover"};}
export async function operationQueue(headers:Headers,tab:unknown="ready",after:string|null=null):Promise<OperationView>{
 requireOrdering();if(!operationTabs.includes(tab as OperationTab))throw new HttpError(400,"INVALID_INPUT");const cursor=after?idField(after):null,who=await requireEmployee(headers);
 return transaction(async client=>{
  const roles=await lockEmployee(client,who,["delivery","owner","supervisor"]),canManage=roles.includes("owner")||roles.includes("supervisor"),canDeliver=roles.includes("delivery")||roles.includes("owner");
  const service=(await client.query('SELECT paused,delivery_paused AS "deliveryPaused",delivery_reason AS "deliveryReason",version FROM court_service WHERE id=1 FOR SHARE')).rows[0];
  if(!service)throw new HttpError(503,"NOT_READY");
  const result=await client.query(`WITH eligible AS MATERIALIZED (
   SELECT o.*,u.name AS delivery_name FROM customer_order o LEFT JOIN "user" u ON u.id=o.delivery_assignee_id
   WHERE o.evidence_mode='court_test' AND ($3::boolean OR o.state='ready' OR o.delivery_assignee_id=$2)
  ), flags AS (SELECT *,state='ready' AS ready,delivery_assignee_id=$2 AND state IN ('delivery_claimed','out_for_delivery','awaiting_handover') AS mine,
   state NOT IN ('canceled','unpaid_handover','exception') AS active,state='exception' AS review,state IN ('canceled','unpaid_handover') AS closed FROM eligible),
  page AS (SELECT * FROM flags WHERE CASE $1 WHEN 'ready' THEN ready WHEN 'mine' THEN mine WHEN 'active' THEN active WHEN 'review' THEN review ELSE closed END
   AND ($4::text IS NULL OR (created_at,id)>(SELECT created_at,id FROM customer_order WHERE id=$4 AND evidence_mode='court_test')) ORDER BY created_at,id LIMIT 51)
  SELECT (SELECT jsonb_build_object('ready',count(*) FILTER(WHERE ready),'mine',count(*) FILTER(WHERE mine),'active',count(*) FILTER(WHERE active),'review',count(*) FILTER(WHERE review),'closed',count(*) FILTER(WHERE closed)) FROM flags) counts,
  (SELECT coalesce(jsonb_agg(entry ORDER BY created_at,id),'[]'::jsonb) FROM (SELECT p.created_at,p.id,jsonb_build_object(
   'id',p.id,'reference',p.public_reference,'customerName',p.customer_name,'phone',CASE WHEN p.delivery_assignee_id=$2 THEN p.phone ELSE NULL END,
   'destination',coalesce(p.effective_destination,p.destination),'originalDestination',p.destination,'state',p.state,'version',p.operation_version,
   'preparationAssigneeId',p.preparation_assignee_id,'deliveryAssigneeId',p.delivery_assignee_id,'deliveryAssigneeName',p.delivery_name,
   'heldState',p.held_state,'reason',p.reason,'incident',p.incident,'contactAttempt',p.contact_attempt,'collectedAt',p.collected_at,'arrivedAt',p.arrived_at,'returnedAt',p.returned_at,'createdAt',p.created_at,
   'items',(SELECT jsonb_agg(jsonb_build_object('name',name,'nameEn',name_en,'quantity',quantity) ORDER BY product_id) FROM order_item WHERE order_id=p.id)) entry FROM page p) rows) orders`,[tab,who.user.id,canManage,cursor]);
  const value=result.rows[0],orders=value.orders.slice(0,50);
  const assignees=canManage?(await client.query(`SELECT u.id,u.name,jsonb_agg(r.role ORDER BY r.role) roles FROM "user" u JOIN employee_role r ON r.user_id=u.id WHERE u.enabled AND NOT u.must_change_password AND r.role IN ('preparation','delivery','owner') GROUP BY u.id ORDER BY u.name,u.id`)).rows:[];
  const courts=canManage?(await client.query("SELECT l.id,b.name||' / '||l.name AS name FROM location l JOIN building b ON b.id=l.building_id WHERE l.kind='court' AND l.active AND b.active ORDER BY b.name,l.name,l.id")).rows:[];
  return {employee:{id:who.user.id,name:who.user.name,canManage,canDeliver},service,counts:value.counts,orders,next:value.orders.length>50?orders.at(-1)!.id:null,assignees,courts};
 });
}
export async function operationAction(headers:Headers,raw:Record<string,unknown>){
 requireOrdering();const input=operationInput(raw),who=await requireEmployee(headers,true),hash=digest(JSON.stringify({actor:who.user.id,...input}));
 return transaction(async client=>{
  // Same lock order as Team edits prevents target-role changes/reassignment deadlocks.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('employee-management',0))");
  const roles=await lockEmployee(client,who,["delivery","owner","supervisor"]),managed=managedActions.includes(input.kind),privileged=roles.includes("owner")||roles.includes("supervisor");
  if(managed&&!privileged || !managed&&!roles.includes("owner")&&!roles.includes("delivery"))throw new HttpError(403,"FORBIDDEN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`operation:${input.id}`]);
  const prior=(await client.query("SELECT digest FROM operation_command WHERE id=$1",[input.id])).rows[0];
  if(prior){if(prior.digest!==hash)throw new HttpError(409,"COMMAND_ID_REUSED");return {accepted:true,replayed:true};}
  if(input.kind==="pause_delivery"||input.kind==="resume_delivery"){
   const service=(await client.query("SELECT version,delivery_paused FROM court_service WHERE id=1 FOR UPDATE")).rows[0];
   if(!service||service.version!==input.version||service.delivery_paused===(input.kind==="pause_delivery"))throw new HttpError(409,"SERVICE_CHANGED");
   await client.query("UPDATE court_service SET delivery_paused=$1,delivery_reason=$2,version=version+1,actor_id=$3,updated_at=clock_timestamp() WHERE id=1",[input.kind==="pause_delivery",input.reason??null,who.user.id]);
   await client.query("INSERT INTO operation_command (id,actor_id,kind,digest,reason,service_version) VALUES ($1,$2,$3,$4,$5,$6)",[input.id,who.user.id,input.kind,hash,input.reason??null,service.version+1]);
   return {accepted:true,replayed:false};
  }
  // Claim takes the service lock first, matching the pause/check-out serialization order.
  if(input.kind==="claim"){
   const service=(await client.query("SELECT delivery_paused FROM court_service WHERE id=1 FOR SHARE")).rows[0];
   if(!service||service.delivery_paused)throw new HttpError(409,"DELIVERY_PAUSED");
  }
  const order=await orderLock(client,input.orderId!);
  if(order.evidence_mode!=="court_test")throw new HttpError(409,"COURT_ONLY");
  if(order.operation_version!==input.version)throw new HttpError(409,"TASK_CHANGED");
  if(["canceled","unpaid_handover"].includes(order.state))throw new HttpError(409,"TASK_CLOSED");
  const before=snapshot(order),physicalStage=stage(order),assigned=order.delivery_assignee_id===who.user.id;
  if(!managed&&input.kind!=="claim"&&!assigned)throw new HttpError(403,"NOT_ASSIGNEE");
  switch(input.kind){
   case "claim":
    if(order.state!=="ready")throw new HttpError(409,"TASK_CHANGED");
    await client.query("UPDATE customer_order SET state='delivery_claimed',delivery_assignee_id=$2,delivery_claimed_at=clock_timestamp() WHERE id=$1",[order.id,who.user.id]);break;
   case "collect":
    if(order.state!=="delivery_claimed")throw new HttpError(409,"TASK_CHANGED");
    await client.query("UPDATE customer_order SET state='out_for_delivery',collected_at=clock_timestamp() WHERE id=$1",[order.id]);break;
   case "arrive":
    if(order.state!=="out_for_delivery")throw new HttpError(409,"TASK_CHANGED");
    await client.query("UPDATE customer_order SET state='awaiting_handover',arrived_at=clock_timestamp() WHERE id=$1",[order.id]);break;
   case "hold":
    if(!["delivery_claimed","out_for_delivery","awaiting_handover"].includes(order.state))throw new HttpError(409,"TASK_CHANGED");
    if(input.incident!=="other"&&order.state!=="awaiting_handover")throw new HttpError(400,"ARRIVAL_REQUIRED");
    await client.query("UPDATE customer_order SET state='exception',reason=$2,incident=$3,contact_attempt=coalesce($4,contact_attempt) WHERE id=$1",[order.id,input.reason,input.incident,input.contactAttempt??null]);break;
   case "contact":
    if(physicalStage!=="awaiting_handover")throw new HttpError(409,"ARRIVAL_REQUIRED");
    await client.query("UPDATE customer_order SET contact_attempt=$2 WHERE id=$1",[order.id,input.contactAttempt]);break;
   case "return":
    if(order.state!=="exception"||!order.collected_at||order.returned_at)throw new HttpError(409,"RETURN_NOT_AVAILABLE");
    await client.query("UPDATE customer_order SET returned_at=clock_timestamp() WHERE id=$1",[order.id]);break;
   case "resume":{
    if(order.state!=="exception")throw new HttpError(409,"TASK_CHANGED");
    if(order.returned_at){
     await eligibleAssignee(client,order.delivery_assignee_id!,"delivery");
     await client.query("UPDATE customer_order SET state='delivery_claimed',held_state=NULL,reason=NULL,incident=NULL,contact_attempt=NULL,delivery_claimed_at=clock_timestamp(),collected_at=NULL,arrived_at=NULL,returned_at=NULL WHERE id=$1",[order.id]);
     break;
    }
    const target=physicalStage==="preparing"?order.preparation_assignee_id:["delivery_claimed","out_for_delivery","awaiting_handover"].includes(physicalStage)?order.delivery_assignee_id:null;
    if(target)await eligibleAssignee(client,target,physicalStage==="preparing"?"preparation":"delivery");
    await client.query("UPDATE customer_order SET state=$2,held_state=NULL,reason=NULL,incident=NULL WHERE id=$1",[order.id,physicalStage]);break;
   }
   case "reassign":{
    const preparation=physicalStage==="preparing";
    if(!preparation&&!["delivery_claimed","out_for_delivery","awaiting_handover"].includes(physicalStage))throw new HttpError(409,"CLAIM_REQUIRED");
    await eligibleAssignee(client,input.targetId!,preparation?"preparation":"delivery");
    if(input.targetId===(preparation?order.preparation_assignee_id:order.delivery_assignee_id))throw new HttpError(400,"ASSIGNEE_UNCHANGED");
    await client.query(`UPDATE customer_order SET ${preparation?"preparation_assignee_id":"delivery_assignee_id"}=$2 WHERE id=$1`,[order.id,input.targetId]);break;
   }
   case "cancel":
    if(order.collected_at&&!order.returned_at)throw new HttpError(409,"RETURN_REQUIRED");
    await client.query("UPDATE customer_order SET state='canceled',held_state=NULL,reason=$2 WHERE id=$1",[order.id,input.reason]);break;
   case "correct":{
    const destination=await availableDestination(client,input.locationId!,"court");
    if(input.locationId===(order.effective_location_id??order.location_id))throw new HttpError(400,"LOCATION_UNCHANGED");
    await client.query("UPDATE customer_order SET effective_location_id=$2,effective_destination=$3 WHERE id=$1",[order.id,input.locationId,destination]);break;
   }
   case "unpaid_handover":
    if(physicalStage!=="awaiting_handover"||order.returned_at)throw new HttpError(409,"HANDOVER_NOT_AVAILABLE");
    await client.query("UPDATE customer_order SET state='unpaid_handover',unpaid_handover_at=clock_timestamp(),held_state=NULL,incident=NULL,reason=$2 WHERE id=$1",[order.id,input.reason]);break;
  }
  const after=snapshot(await orderLock(client,order.id));
  await client.query("INSERT INTO operation_command (id,actor_id,order_id,kind,digest,reason,physical_check,\"before\",\"after\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
   [input.id,who.user.id,order.id,input.kind,hash,input.reason??null,input.physicalCheck??null,JSON.stringify(before),JSON.stringify(after)]);
  await client.query("INSERT INTO order_event (id,order_id,actor_id,kind,detail) VALUES ($1,$2,$3,$4,$5)",[input.id,order.id,who.user.id,`operation_${input.kind}`,input.reason??input.kind]);
  return {accepted:true,replayed:false};
 });
}
async function eligibleAssignee(client:import("pg").PoolClient,id:string,role:string){
 const user=(await client.query('SELECT id FROM "user" WHERE id=$1 AND enabled AND NOT must_change_password FOR SHARE',[id])).rowCount;
 const roles=(await client.query("SELECT role FROM employee_role WHERE user_id=$1 AND role=ANY($2::text[]) FOR SHARE",[id,[role,"owner"]])).rowCount;
 if(!user||!roles)throw new HttpError(409,"ASSIGNEE_UNAVAILABLE");
}
