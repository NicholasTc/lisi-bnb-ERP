import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetTestData, testPool } from "../database";
import { createCourtOrder, createOrder, guestOrder } from "../../src/server/orders";
import { preparationAction, preparationQueue } from "../../src/server/preparation";
import { getPool } from "../../src/server/db/client";
import { provisionEmployee, disableEmployee } from "../../src/server/provisioning";
import { authRequest } from "../../src/server/auth-http";
import { readConfig } from "../../src/server/config";
import { publicCatalog } from "../../src/server/catalog";
import { POST, GET } from "../../src/app/api/employee/preparation/route";
import { issueDemoEvent } from "../../src/server/demo-payments";
const pool=testPool(), config=readConfig(), password=randomBytes(20).toString("hex");
let productId:string,courtId:string,owner:Headers,prep:Headers,supervisor:Headers,limited:Headers,ownerId:string;
const input=()=>({id:randomUUID(),accessKey:randomBytes(32).toString("hex"),customerName:"Court guest",phone:"081234567890",kind:"court",locationId:courtId,locationConfirmed:true,items:[{productId,quantity:1,priceIdr:20000}]});
const command=(kind:string,orderId:string)=>({id:randomUUID(),kind,orderId});
async function login(role:"owner"|"preparation"|"supervisor"|"delivery") {
 const email=`${role}@prep.example.invalid`,id=await provisionEmployee(pool,{email,name:role,password,roles:[role]});
 const response=await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({email,password})}));
 expect(response.status).toBe(200);return {id,headers:new Headers({cookie:response.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ")})};
}
beforeEach(async()=>{
 await resetTestData(pool);productId=randomUUID();courtId=randomUUID();const building=randomUUID();
 await pool.query("INSERT INTO product(id,name,category,price_idr) VALUES ($1,'Coffee','Drinks',20000)",[productId]);
 await pool.query("INSERT INTO building(id,name) VALUES ($1,'Hall')",[building]);
 await pool.query("INSERT INTO location(id,building_id,kind,name) VALUES ($1,$2,'court','Padel 1')",[courtId,building]);
 const a=await login("owner");owner=a.headers;ownerId=a.id;prep=(await login("preparation")).headers;supervisor=(await login("supervisor")).headers;limited=(await login("delivery")).headers;
});
afterAll(async()=>{await resetTestData(pool);await pool.end();await getPool().end();});
describe("durable court preparation",()=>{
 it("enforces current role permissions and excludes customer contact/recovery/financial data",async()=>{
  await createCourtOrder(input());
  await expect(preparationQueue(new Headers())).rejects.toMatchObject({status:401});
  await expect(preparationQueue(limited)).rejects.toMatchObject({status:403});
  const queue=await preparationQueue(supervisor);expect(queue.employee.canWork).toBe(false);expect(queue.orders).toHaveLength(1);
  expect(JSON.stringify(queue)).not.toMatch(/081234567890|accessHash|accessKey|access_hash|payment|email/);
  await expect(preparationAction(supervisor,command("claim",queue.orders[0].id))).rejects.toMatchObject({status:403});
  expect((await preparationQueue(prep)).employee.canWork).toBe(true);
  expect((await preparationQueue(owner)).employee.canWork).toBe(true);
  await pool.query("DELETE FROM employee_role WHERE user_id=$1",[ownerId]);
  await expect(preparationQueue(owner)).rejects.toMatchObject({status:403});
 });
 it("two employees racing for a task have exactly one durable winner",async()=>{
  const order=await createCourtOrder(input());
  const outcomes=await Promise.allSettled([preparationAction(owner,command("claim",order.id)),preparationAction(prep,command("claim",order.id))]);
  expect(outcomes.filter(v=>v.status==="fulfilled")).toHaveLength(1);
  expect(outcomes.filter(v=>v.status==="rejected")).toHaveLength(1);
  const row=(await pool.query("SELECT * FROM customer_order WHERE id=$1",[order.id])).rows[0];expect(row.state).toBe("preparing");expect(row.preparation_assignee_id).toBeTruthy();
  expect((await pool.query("SELECT count(*) FROM order_event WHERE kind='preparation_claim'")).rows[0].count).toBe("1");
 });
 it("safe replay survives later progress; changed IDs/bodies/actors cannot claim twice",async()=>{
  const value=input(),order=await createCourtOrder(value),claim=command("claim",order.id),ready=command("ready",order.id);
  await Promise.all([preparationAction(owner,claim),preparationAction(owner,claim)]);
  await expect(preparationAction(prep,ready)).rejects.toMatchObject({code:"NOT_ASSIGNEE"});
  await preparationAction(owner,ready);await preparationAction(owner,ready);
  expect(await preparationAction(owner,claim)).toMatchObject({replayed:true});
  await expect(preparationAction(prep,claim)).rejects.toMatchObject({code:"COMMAND_ID_REUSED"});
  await expect(preparationAction(owner,{...claim,kind:"ready"})).rejects.toMatchObject({code:"COMMAND_ID_REUSED"});
  await expect(preparationAction(owner,command("claim",order.id))).rejects.toMatchObject({code:"TASK_CHANGED"});
  expect((await guestOrder({id:order.id,accessKey:value.accessKey}))).toMatchObject({state:"ready",paymentStatus:"unpaid",receivedIdr:"0"});
  expect((await pool.query("SELECT count(*) FROM preparation_command")).rows[0].count).toBe("2");
  expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");
  await expect(issueDemoEvent(owner,{id:randomUUID(),orderId:order.id,status:"succeeded"})).rejects.toBeDefined();
 });
 it("cancel versus claim has one valid outcome and claimed/ready orders cannot be guest-canceled",async()=>{
  const value=input();await createCourtOrder(value);
  const outcomes=await Promise.allSettled([preparationAction(owner,command("claim",value.id)),guestOrder({id:value.id,accessKey:value.accessKey},true)]);
  expect(outcomes.filter(v=>v.status==="fulfilled")).toHaveLength(1);
  const state=(await pool.query("SELECT state FROM customer_order WHERE id=$1",[value.id])).rows[0].state;
  expect(["preparing","canceled"]).toContain(state);
  const second=input();await createCourtOrder(second);await preparationAction(owner,command("claim",second.id));
  await expect(guestOrder({id:second.id,accessKey:second.accessKey},true)).rejects.toMatchObject({code:"PREPARATION_ALREADY_STARTED"});
  await preparationAction(owner,command("ready",second.id));
  await expect(guestOrder({id:second.id,accessKey:second.accessKey},true)).rejects.toMatchObject({code:"PREPARATION_ALREADY_STARTED"});
 });
 it("holds suspicious or unavailable work with a reason and no fake payment/cancellation",async()=>{
  for(const claimed of [false,true]){
   const value=input();await createCourtOrder(value);if(claimed)await preparationAction(owner,command("claim",value.id));
   await expect(preparationAction(owner,{...command("hold",value.id),reason:" "})).rejects.toMatchObject({status:400});
   await preparationAction(owner,{...command("hold",value.id),reason:"Ingredient unavailable"});
   const order=await guestOrder({id:value.id,accessKey:value.accessKey});expect(order).toMatchObject({state:"exception",reason:null,paymentStatus:"unpaid"});
   await expect(preparationAction(owner,command("ready",value.id))).rejects.toMatchObject({code:"TASK_CHANGED"});
  }
  expect((await preparationQueue(supervisor,"exception")).orders).toHaveLength(2);
 });
 it("persists audited pauses, blocks new checkout, preserves retries and continues existing preparation",async()=>{
  const value=input();await createCourtOrder(value);const pause={id:randomUUID(),kind:"pause",version:1,reason:"Busy café"};
  await preparationAction(prep,pause);expect((await publicCatalog(null)).orderingPaused).toBe(true);
  await expect(createCourtOrder(input())).rejects.toMatchObject({code:"ORDERING_PAUSED"});
  expect((await createCourtOrder(value)).id).toBe(value.id);
  await preparationAction(owner,command("claim",value.id));await preparationAction(owner,command("ready",value.id));
  await expect(preparationAction(owner,{id:randomUUID(),kind:"resume",version:1})).rejects.toMatchObject({code:"SERVICE_CHANGED"});
  await preparationAction(owner,{id:randomUUID(),kind:"resume",version:2});await preparationAction(prep,pause);
  expect((await publicCatalog(null)).orderingPaused).toBe(false);await createCourtOrder(input());
 });
 it("serializes concurrent pause changes and first checkouts without losing committed orders",async()=>{
  const value=input();
  const results=await Promise.allSettled([createCourtOrder(value),preparationAction(owner,{id:randomUUID(),kind:"pause",version:1,reason:"Break"}),preparationAction(prep,{id:randomUUID(),kind:"pause",version:1,reason:"Break"})]);
  expect(results.slice(1).filter(r=>r.status==="fulfilled")).toHaveLength(1);
  const count=Number((await pool.query("SELECT count(*) FROM customer_order")).rows[0].count);
  expect(count).toBe(results[0].status==="fulfilled"?1:0);expect((await preparationQueue(owner)).service.paused).toBe(true);
  if(count)expect((await createCourtOrder(value)).id).toBe(value.id);
 });
 it("rolls back ownership, status and command if audit insertion fails",async()=>{
  const value=input();await createCourtOrder(value);const cmd=command("claim",value.id);
  await pool.query("CREATE FUNCTION reject_preparation_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='preparation_claim' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$");
  await pool.query("CREATE TRIGGER reject_preparation_audit_test BEFORE INSERT ON order_event FOR EACH ROW EXECUTE FUNCTION reject_preparation_audit_test()");
  try{await expect(preparationAction(owner,cmd)).rejects.toThrow();}
  finally{await pool.query("DROP TRIGGER reject_preparation_audit_test ON order_event");await pool.query("DROP FUNCTION reject_preparation_audit_test()");}
  expect((await pool.query("SELECT state,preparation_assignee_id FROM customer_order WHERE id=$1",[value.id])).rows[0]).toEqual({state:"awaiting_preparation",preparation_assignee_id:null});
  expect((await pool.query("SELECT count(*) FROM preparation_command")).rows[0].count).toBe("0");await preparationAction(owner,cmd);
 });
 it("database guards reject unaudited progress, history rewrites, forged readiness and illegal transitions",async()=>{
  const value=input();await createCourtOrder(value);
  await expect(pool.query("UPDATE customer_order SET state='ready' WHERE id=$1",[value.id])).rejects.toMatchObject({code:"23514"});
  await expect(pool.query("UPDATE customer_order SET state='preparing',preparation_assignee_id=$2,preparation_claimed_at=clock_timestamp() WHERE id=$1",[value.id,ownerId])).rejects.toMatchObject({code:"23514"});
  await preparationAction(owner,command("claim",value.id));await preparationAction(owner,command("ready",value.id));
  for(const sql of ["state='preparing'","preparation_ready_at=NULL","preparation_ready_at=clock_timestamp()","destination='wrong court'","total_idr=1","state='canceled'"])
   await expect(pool.query(`UPDATE customer_order SET ${sql} WHERE id=$1`,[value.id])).rejects.toMatchObject({code:"23514"});
  await expect(pool.query("UPDATE preparation_command SET kind='ready'")).rejects.toMatchObject({code:"23514"});
  await expect(pool.query("UPDATE court_service SET paused=true,reason='Break',version=2,actor_id=$1",[ownerId])).rejects.toMatchObject({code:"23514"});
 });
 it("passive polling never extends inactivity and revoked/disabled sessions cannot work",async()=>{
  const value=input();await createCourtOrder(value);await pool.query("UPDATE session SET last_activity_at=clock_timestamp()-interval '29 minutes' WHERE user_id=$1",[ownerId]);
  const before=(await pool.query("SELECT last_activity_at FROM session WHERE user_id=$1",[ownerId])).rows[0].last_activity_at;
  await preparationQueue(owner);expect((await pool.query("SELECT last_activity_at FROM session WHERE user_id=$1",[ownerId])).rows[0].last_activity_at).toEqual(before);
  await pool.query("UPDATE session SET last_activity_at=clock_timestamp()-interval '30 minutes' WHERE user_id=$1",[ownerId]);
  await expect(preparationAction(owner,command("claim",value.id))).rejects.toMatchObject({status:401});
  await disableEmployee(pool,ownerId);await expect(preparationQueue(owner)).rejects.toMatchObject({status:401});
 });
 it("paginates more than 50 orders oldest first, recovers after reload and ignores legacy demo work",async()=>{
  const value=input();await createCourtOrder(value);
  // Clone immutable snapshots inside one transaction; independent fixture avoids guest throttle.
  const client=await pool.connect();try{await client.query("BEGIN");for(let i=0;i<52;i++){
   const id=randomUUID();await client.query(`INSERT INTO customer_order(id,request_digest,access_hash,source,customer_name,phone,kind,location_id,destination,total_idr,evidence_mode,state,public_reference,created_at,access_expires_at)
    SELECT $1,request_digest,$2,source,customer_name,phone,kind,location_id,destination,total_idr,evidence_mode,state,$3,created_at+($4::int*interval '1 microsecond'),access_expires_at+($4::int*interval '1 microsecond') FROM customer_order WHERE id=$5`,[id,randomBytes(32).toString("hex"),`LB-${randomBytes(5).toString("hex").toUpperCase()}`,i+1,value.id]);
   await client.query("INSERT INTO order_item SELECT $1,product_id,name,name_en,description,description_en,quantity,unit_price_idr FROM order_item WHERE order_id=$2",[id,value.id]);
  }await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  const first=await preparationQueue(owner);expect(first.counts.awaiting_preparation).toBe(53);expect(first.orders).toHaveLength(50);
  await preparationAction(owner,command("claim",first.orders.at(-1)!.id));
  const next=await preparationQueue(owner,"awaiting_preparation",first.next);expect(next.orders).toHaveLength(3);
  expect(new Set([...first.orders,...next.orders].map(o=>o.id)).size).toBe(53);
  const legacy=await createOrder({...input(),kind:"pickup",phone:null,locationId:null,locationConfirmed:false});
  await expect(preparationAction(owner,command("claim",legacy.id))).rejects.toMatchObject({code:"COURT_ONLY"});
  expect((await preparationQueue(owner,"preparing")).orders[0].assigneeId).toBe(ownerId);
 });
 it("keeps all preparation operations closed in production before database access",async()=>{
  const saved={APP_ENV:process.env.APP_ENV,APP_ORIGIN:process.env.APP_ORIGIN,DATABASE_URL:process.env.DATABASE_URL,PAYMENTS_MODE:process.env.PAYMENTS_MODE};
  try{
   process.env.APP_ENV="production";process.env.PAYMENTS_MODE="disabled";process.env.APP_ORIGIN="https://erp.example.invalid";
   process.env.DATABASE_URL=`postgresql://runtime:${password}@db.example.invalid/lisi_production?sslmode=verify-full`;
   await expect(preparationQueue(owner)).rejects.toMatchObject({status:404,code:"ORDERING_UNAVAILABLE"});
   await expect(preparationAction(owner,command("claim",randomUUID()))).rejects.toMatchObject({status:404,code:"ORDERING_UNAVAILABLE"});
  }finally{Object.assign(process.env,saved);}
 });
 it("expired private access cannot be recovered by replaying the original checkout body",async()=>{
  const value=input();await createCourtOrder(value);
  await pool.query("UPDATE customer_order SET access_expires_at=created_at+interval '1 millisecond' WHERE id=$1",[value.id]);
  await new Promise(resolve=>setTimeout(resolve,5));
  await expect(createCourtOrder(value)).rejects.toMatchObject({code:"ORDER_NOT_FOUND"});
  await expect(guestOrder({id:value.id,accessKey:value.accessKey})).rejects.toMatchObject({code:"ORDER_NOT_FOUND"});
  expect((await preparationQueue(owner)).orders).toHaveLength(1);
 });
 it("protects HTTP mutations from cross-origin/oversized/forged requests",async()=>{
  const headers=new Headers(owner);headers.set("origin","https://evil.example.invalid");headers.set("content-type","application/json");
  expect((await POST(new Request(`${config.origin}/api/employee/preparation`,{method:"POST",headers,body:JSON.stringify(command("claim",randomUUID()))}))).status).toBe(403);
  headers.set("origin",config.origin);
  expect((await POST(new Request(`${config.origin}/api/employee/preparation`,{method:"POST",headers,body:JSON.stringify({junk:"x".repeat(17000)})}))).status).toBe(413);
  expect((await GET(new Request(`${config.origin}/api/employee/preparation?state=completed`,{headers:owner}))).status).toBe(400);
 });
});
