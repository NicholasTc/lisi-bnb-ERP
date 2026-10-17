import {randomBytes,randomUUID} from "node:crypto";
import {beforeEach,afterAll,it,expect} from "vitest";
import {testPool,resetTestData} from "../database";
import {provisionEmployee,disableEmployee} from "../../src/server/provisioning";
import {operationQueue,operationAction} from "../../src/server/operations";
import {preparationAction,preparationQueue} from "../../src/server/preparation";
import {createCourtOrder,guestOrder} from "../../src/server/orders";
import {publicCatalog} from "../../src/server/catalog";
import {getPool} from "../../src/server/db/client";
import {authRequest} from "../../src/server/auth-http";
import {readConfig} from "../../src/server/config";
const pool=testPool(),config=readConfig(),password=randomBytes(20).toString("hex");
let owner:Headers,delivery:Headers,other:Headers,prep:Headers,supervisor:Headers,deliveryId:string,otherId:string,productId:string,courtId:string,secondCourt:string;
async function employee(role:"owner"|"delivery"|"preparation"|"supervisor",name=role as string){const email=`${name}@ops.example.invalid`,id=await provisionEmployee(pool,{name,email,password,roles:[role]});const response=await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({email,password})}));expect(response.status).toBe(200);return {id,headers:new Headers({cookie:response.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ")})};}
const input=()=>({id:randomUUID(),accessKey:randomBytes(32).toString("hex"),customerName:"Court Guest",phone:"081234567890",kind:"court",locationId:courtId,locationConfirmed:true,items:[{productId,quantity:1,priceIdr:20000}]});
async function order(ready=true){const body=input();await createCourtOrder(body);if(ready){await preparationAction(owner,{id:randomUUID(),kind:"claim",orderId:body.id});await preparationAction(owner,{id:randomUUID(),kind:"ready",orderId:body.id});}return body;}
async function cmd(id:string,kind:string,extra:Record<string,unknown>={}){return {id:randomUUID(),orderId:id,version:(await pool.query("SELECT operation_version FROM customer_order WHERE id=$1",[id])).rows[0].operation_version,kind,...extra};}
const check={reason:"Physical recovery",physicalCheck:"Checked staff and actual drinks"};
async function arrive(id:string){for(const kind of ["claim","collect","arrive"])await operationAction(delivery,await cmd(id,kind));}
beforeEach(async()=>{await resetTestData(pool);const a=await employee("owner");owner=a.headers;const b=await employee("delivery");delivery=b.headers;deliveryId=b.id;const c=await employee("delivery","other");other=c.headers;otherId=c.id;prep=(await employee("preparation")).headers;supervisor=(await employee("supervisor")).headers;
 productId=randomUUID();courtId=randomUUID();secondCourt=randomUUID();const building=randomUUID();await pool.query("INSERT INTO product(id,name,category,price_idr) VALUES ($1,'Coffee','Drinks',20000)",[productId]);await pool.query("INSERT INTO building(id,name) VALUES ($1,'Hall')",[building]);await pool.query("INSERT INTO location(id,building_id,kind,name) VALUES ($1,$2,'court','Court 1'),($3,$2,'court','Court 2')",[courtId,building,secondCourt]);});
afterAll(async()=>{await resetTestData(pool);await pool.end();await getPool().end();});
it("separates delivery/preparation/supervisor access and exposes contact only to the assigned employee",async()=>{
 const value=await order();await expect(operationQueue(new Headers())).rejects.toMatchObject({status:401});await expect(operationQueue(prep)).rejects.toMatchObject({status:403});
 const queue=await operationQueue(delivery);expect(queue.orders[0].phone).toBeNull();expect((await operationQueue(supervisor)).employee).toMatchObject({canDeliver:false,canManage:true});
 await expect(operationAction(supervisor,await cmd(value.id,"claim"))).rejects.toMatchObject({status:403});await operationAction(delivery,await cmd(value.id,"claim"));
 expect((await operationQueue(delivery,"mine")).orders[0].phone).toBe(value.phone);expect((await operationQueue(supervisor,"active")).orders[0].phone).toBeNull();expect((await operationQueue(other,"mine")).orders).toHaveLength(0);
});
it("simultaneous delivery claims have one winner, and replay survives later progress",async()=>{
 const value=await order(),a=await cmd(value.id,"claim"),b={...a,id:randomUUID()};const results=await Promise.allSettled([operationAction(delivery,a),operationAction(other,b)]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 const row=(await pool.query("SELECT delivery_assignee_id FROM customer_order WHERE id=$1",[value.id])).rows[0],winner=row.delivery_assignee_id===deliveryId?delivery:other,body=row.delivery_assignee_id===deliveryId?a:b;
 await operationAction(winner,await cmd(value.id,"collect"));expect(await operationAction(winner,body)).toMatchObject({replayed:true});
 await expect(operationAction(winner,{...body,kind:"arrive"})).rejects.toMatchObject({code:"COMMAND_ID_REUSED"});expect((await pool.query("SELECT count(*) FROM operation_command WHERE kind='claim'")).rows[0].count).toBe("1");
});
it("records collection/arrival separately from payment and rejects normal completion or skipping steps",async()=>{
 const value=await order();await operationAction(delivery,await cmd(value.id,"claim"));await expect(operationAction(delivery,await cmd(value.id,"arrive"))).rejects.toMatchObject({code:"TASK_CHANGED"});
 for(const kind of ["collect","arrive"]){const body=await cmd(value.id,kind);await operationAction(delivery,body);await operationAction(delivery,body);}
 expect(await guestOrder({id:value.id,accessKey:value.accessKey})).toMatchObject({state:"awaiting_handover",paymentStatus:"unpaid",receivedIdr:"0"});
 await expect(operationAction(delivery,await cmd(value.id,"complete"))).rejects.toMatchObject({status:400});await expect(operationAction(delivery,await cmd(value.id,"unpaid_handover",check))).rejects.toMatchObject({status:403});
 expect((await pool.query("SELECT count(*) FROM payment_transaction")).rows[0].count).toBe("0");
});
it("delivery pause persists, blocks new claims/checkout and leaves claimed tasks progressable",async()=>{
 const a=await order(),b=await order();await operationAction(delivery,await cmd(a.id,"claim"));
 const body={id:randomUUID(),kind:"pause_delivery",version:1,reason:"No available runners"};await operationAction(delivery,body);
 expect((await publicCatalog(null)).orderingPaused).toBe(true);await expect(createCourtOrder(input())).rejects.toMatchObject({code:"ORDERING_PAUSED"});expect((await createCourtOrder(a)).id).toBe(a.id);
 await expect(operationAction(other,await cmd(b.id,"claim"))).rejects.toMatchObject({code:"DELIVERY_PAUSED"});await operationAction(delivery,await cmd(a.id,"collect"));
 await expect(operationAction(owner,{id:randomUUID(),kind:"resume_delivery",version:1})).rejects.toMatchObject({code:"SERVICE_CHANGED"});await operationAction(owner,{id:randomUUID(),kind:"resume_delivery",version:2});await operationAction(delivery,body);expect((await publicCatalog(null)).orderingPaused).toBe(false);
});
it("reassigns preparation or delivery without resetting physical progress; former assignees cannot act",async()=>{
 const value=await order(false);await preparationAction(owner,{id:randomUUID(),kind:"claim",orderId:value.id});
 const prepId=(await pool.query("SELECT user_id FROM employee_role WHERE role='preparation'")).rows[0].user_id;
 await expect(operationAction(supervisor,await cmd(value.id,"reassign",{targetId:prepId,reason:"shift"}))).rejects.toMatchObject({status:400});
 await operationAction(supervisor,await cmd(value.id,"reassign",{...check,targetId:prepId}));await expect(preparationAction(owner,{id:randomUUID(),kind:"ready",orderId:value.id})).rejects.toMatchObject({code:"NOT_ASSIGNEE"});await preparationAction(prep,{id:randomUUID(),kind:"ready",orderId:value.id});
 await operationAction(delivery,await cmd(value.id,"claim"));await operationAction(delivery,await cmd(value.id,"collect"));const before=(await pool.query("SELECT collected_at FROM customer_order WHERE id=$1",[value.id])).rows[0];
 await operationAction(supervisor,await cmd(value.id,"reassign",{...check,targetId:otherId}));await expect(operationAction(delivery,await cmd(value.id,"arrive"))).rejects.toMatchObject({code:"NOT_ASSIGNEE"});await operationAction(other,await cmd(value.id,"arrive"));expect((await pool.query("SELECT collected_at FROM customer_order WHERE id=$1",[value.id])).rows[0]).toEqual(before);
});
it("requires contact and return before closing absent/refused deliveries, keeping unpaid exception history",async()=>{
 const value=await order();await arrive(value.id);await expect(operationAction(delivery,await cmd(value.id,"hold",{reason:"No customer",incident:"absent"}))).rejects.toMatchObject({status:400});
 await operationAction(delivery,await cmd(value.id,"hold",{reason:"No customer",incident:"absent",contactAttempt:"Called at court; no answer"}));await expect(operationAction(owner,await cmd(value.id,"cancel",check))).rejects.toMatchObject({code:"RETURN_REQUIRED"});
 await operationAction(delivery,await cmd(value.id,"return",{reason:"Drinks returned to café"}));await operationAction(supervisor,await cmd(value.id,"cancel",check));
 const row=(await pool.query("SELECT state,returned_at FROM customer_order WHERE id=$1",[value.id])).rows[0];expect(row.state).toBe("canceled");expect(row.returned_at).toBeTruthy();expect((await pool.query("SELECT \"after\" FROM operation_command WHERE kind='cancel'")).rows[0].after.preparedUnpaidException).toBe(true);
});
it("supervised unpaid handover requires physical evidence, stays unpaid and is terminal",async()=>{
 const value=await order();await arrive(value.id);await expect(operationAction(owner,await cmd(value.id,"unpaid_handover",{reason:"Approved exception"}))).rejects.toMatchObject({status:400});
 const body=await cmd(value.id,"unpaid_handover",check);await operationAction(supervisor,body);await operationAction(supervisor,body);
 expect(await guestOrder({id:value.id,accessKey:value.accessKey})).toMatchObject({state:"unpaid_handover",paymentStatus:"unpaid",receivedIdr:"0"});await expect(operationAction(owner,await cmd(value.id,"resume",check))).rejects.toMatchObject({code:"TASK_CLOSED"});
});
it("corrects only to active courts while preserving original destination and rejecting stale checks",async()=>{
 const value=await order();const body=await cmd(value.id,"correct",{...check,locationId:secondCourt});await operationAction(supervisor,body);
 const row=(await pool.query("SELECT destination,effective_destination,operation_version FROM customer_order WHERE id=$1",[value.id])).rows[0];expect(row.destination).toBe("Hall / Court 1");expect(row.effective_destination).toBe("Hall / Court 2");expect((await guestOrder({id:value.id,accessKey:value.accessKey})).destination).toBe("Hall / Court 2");expect((await preparationQueue(owner,"ready")).orders[0].destination).toBe("Hall / Court 2");
 await expect(operationAction(owner,{...body,id:randomUUID()})).rejects.toMatchObject({code:"TASK_CHANGED"});await pool.query("UPDATE location SET active=false WHERE id=$1",[courtId]);await expect(operationAction(owner,await cmd(value.id,"correct",{...check,locationId:courtId}))).rejects.toMatchObject({code:"LOCATION_UNAVAILABLE"});
});
it("resumes preparation holds without losing original actor history",async()=>{
 const value=await order(false);await preparationAction(owner,{id:randomUUID(),kind:"hold",orderId:value.id,reason:"Review"});await operationAction(supervisor,await cmd(value.id,"resume",check));
 expect((await guestOrder({id:value.id,accessKey:value.accessKey})).state).toBe("awaiting_preparation");await preparationAction(owner,{id:randomUUID(),kind:"claim",orderId:value.id});await preparationAction(owner,{id:randomUUID(),kind:"hold",orderId:value.id,reason:"Check stock"});await operationAction(supervisor,await cmd(value.id,"resume",check));await preparationAction(owner,{id:randomUUID(),kind:"ready",orderId:value.id});
});
it("audit failure rolls back claim and command; invalid SQL and disabled assignees cannot progress",async()=>{
 const value=await order(),body=await cmd(value.id,"claim");await pool.query("CREATE FUNCTION reject_operation_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='operation_claim' THEN RAISE EXCEPTION 'audit failure'; END IF; RETURN NEW; END $$");await pool.query("CREATE TRIGGER reject_operation_audit_test BEFORE INSERT ON order_event FOR EACH ROW EXECUTE FUNCTION reject_operation_audit_test()");
 try{await expect(operationAction(delivery,body)).rejects.toThrow();}finally{await pool.query("DROP TRIGGER reject_operation_audit_test ON order_event");await pool.query("DROP FUNCTION reject_operation_audit_test()");}
 expect((await pool.query("SELECT state FROM customer_order WHERE id=$1",[value.id])).rows[0].state).toBe("ready");expect((await pool.query("SELECT count(*) FROM operation_command")).rows[0].count).toBe("0");
 await expect(pool.query("UPDATE customer_order SET state='awaiting_handover' WHERE id=$1",[value.id])).rejects.toMatchObject({code:"23514"});await operationAction(delivery,body);await disableEmployee(pool,deliveryId);await expect(operationAction(delivery,await cmd(value.id,"collect"))).rejects.toMatchObject({status:401});
 await operationAction(supervisor,await cmd(value.id,"reassign",{...check,targetId:otherId}));await operationAction(other,await cmd(value.id,"collect"));
});

it("retrying a returned delivery requires collection again and preserves the previous physical attempt",async()=>{
 const value=await order();await arrive(value.id);await operationAction(delivery,await cmd(value.id,"hold",{reason:"Not found",incident:"absent",contactAttempt:"Called at court; no answer"}));await operationAction(delivery,await cmd(value.id,"return",{reason:"Back at café"}));
 const previous=(await pool.query("SELECT delivery_claimed_at,collected_at,arrived_at,returned_at FROM customer_order WHERE id=$1",[value.id])).rows[0];
 const body=await cmd(value.id,"resume",check);await operationAction(supervisor,body);await operationAction(supervisor,body);
 const current=(await pool.query("SELECT state,delivery_assignee_id,collected_at,arrived_at,returned_at FROM customer_order WHERE id=$1",[value.id])).rows[0];expect(current).toEqual({state:"delivery_claimed",delivery_assignee_id:deliveryId,collected_at:null,arrived_at:null,returned_at:null});
 const history=(await pool.query('SELECT "before" FROM operation_command WHERE id=$1',[body.id])).rows[0].before;
 expect(history.deliveryClaimedAt).toBe(previous.delivery_claimed_at.toISOString());expect(history.collectedAt).toBe(previous.collected_at.toISOString());expect(history.arrivedAt).toBe(previous.arrived_at.toISOString());expect(history.returnedAt).toBe(previous.returned_at.toISOString());
 await expect(operationAction(delivery,await cmd(value.id,"arrive"))).rejects.toMatchObject({code:"TASK_CHANGED"});await operationAction(delivery,await cmd(value.id,"collect"));await operationAction(delivery,await cmd(value.id,"arrive"));
});

it("keeps new delivery/recovery operations closed in production",async()=>{
 const saved={APP_ENV:process.env.APP_ENV,APP_ORIGIN:process.env.APP_ORIGIN,DATABASE_URL:process.env.DATABASE_URL,PAYMENTS_MODE:process.env.PAYMENTS_MODE};
 try{process.env.APP_ENV="production";process.env.APP_ORIGIN="https://erp.example.invalid";process.env.DATABASE_URL=`postgresql://runtime:${password}@db.example.invalid/lisi_production?sslmode=verify-full`;process.env.PAYMENTS_MODE="disabled";
  await expect(operationQueue(owner)).rejects.toMatchObject({status:404});await expect(operationAction(owner,{id:randomUUID(),kind:"pause_delivery",version:1,reason:"Closed"})).rejects.toMatchObject({status:404});
 }finally{Object.assign(process.env,saved);}
});
it("claim versus delivery pause has a single consistent ordering",async()=>{
 const value=await order(),claim=await cmd(value.id,"claim");const results=await Promise.allSettled([operationAction(delivery,claim),operationAction(other,{id:randomUUID(),kind:"pause_delivery",version:1,reason:"Runner break"})]);expect(results[1].status).toBe("fulfilled");
 const state=(await pool.query("SELECT state FROM customer_order WHERE id=$1",[value.id])).rows[0].state;expect(state).toBe(results[0].status==="fulfilled"?"delivery_claimed":"ready");expect((await operationQueue(owner)).service.deliveryPaused).toBe(true);
 if(state==="delivery_claimed")await operationAction(delivery,await cmd(value.id,"collect"));
});
it("two conflicting supervised decisions cannot both change the same version",async()=>{
 const value=await order(),a=await cmd(value.id,"correct",{...check,locationId:secondCourt}),b=await cmd(value.id,"cancel",check);const results=await Promise.allSettled([operationAction(owner,a),operationAction(supervisor,b)]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
 expect((await pool.query("SELECT count(*) FROM operation_command WHERE order_id=$1",[value.id])).rows[0].count).toBe("1");
});
