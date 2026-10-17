import {randomBytes,randomUUID} from "node:crypto";
import {beforeEach,afterAll,it,expect} from "vitest";
import {testPool,resetTestData} from "../database";
import {provisionEmployee} from "../../src/server/provisioning";
import {teamList,teamAction,changeEmployeePassword} from "../../src/server/team";
import {requireEmployee} from "../../src/server/employee";
import {getPool} from "../../src/server/db/client";
import {authRequest} from "../../src/server/auth-http";
import {readConfig} from "../../src/server/config";
import {GET,POST} from "../../src/app/api/employee/team/route";
const pool=testPool(),config=readConfig(),password=randomBytes(20).toString("hex"),nextPassword=randomBytes(20).toString("hex");
let owner:Headers,limited:Headers,ownerId:string;
async function login(email:string,pwd=password){const response=await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({email,password:pwd})}));expect(response.status).toBe(200);return new Headers({cookie:response.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ")});}
const create=()=>({id:randomUUID(),targetId:randomUUID(),kind:"create",name:"New Delivery",email:`${randomUUID()}@example.invalid`,password,roles:["delivery"]});
beforeEach(async()=>{await resetTestData(pool);ownerId=await provisionEmployee(pool,{name:"Owner",email:"owner@team.example.invalid",password,roles:["owner"]});await provisionEmployee(pool,{name:"Limited",email:"limited@team.example.invalid",password,roles:["preparation"]});owner=await login("owner@team.example.invalid");limited=await login("limited@team.example.invalid");});
afterAll(async()=>{await resetTestData(pool);await pool.end();await getPool().end();});
it("only owners can list/count/manage employees; no secrets in the response",async()=>{
 expect((await GET(new Request(`${config.origin}/api/employee/team`))).status).toBe(401);
 await expect(teamList(limited)).rejects.toMatchObject({status:403});await expect(teamAction(limited,create())).rejects.toMatchObject({status:403});
 const list=await teamList(owner);expect(list.counts).toEqual({total:2,active:2,disabled:0});expect(JSON.stringify(list)).not.toMatch(/session|token|password_hash|credential/);
});
it("deduplicates simultaneous employee creation and binds identity/body/actor",async()=>{
 const body=create();await Promise.all([teamAction(owner,body),teamAction(owner,body)]);
 expect((await teamList(owner,body.email)).members).toHaveLength(1);
 expect((await pool.query("SELECT count(*) FROM employee_command WHERE kind='create'")).rows[0].count).toBe("1");
 await expect(teamAction(owner,{...body,name:"Changed"})).rejects.toMatchObject({code:"COMMAND_ID_REUSED"});
 await expect(teamAction(owner,{...create(),email:body.email.toUpperCase()})).rejects.toMatchObject({code:"ALREADY_EXISTS"});
 const journal=JSON.stringify((await pool.query("SELECT * FROM employee_command")).rows);expect(journal).not.toContain(password);
 expect((await pool.query("SELECT password FROM account WHERE user_id=$1",[body.targetId])).rows[0].password).not.toBe(password);
});
it("temporary credentials allow password setup but deny protected operations until changed",async()=>{
 const body=create();await teamAction(owner,body);const headers=await login(body.email);
 expect((await requireEmployee(headers,false,true)).passwordChangeRequired).toBe(true);
 await expect(requireEmployee(headers)).rejects.toMatchObject({code:"PASSWORD_CHANGE_REQUIRED"});
 await expect(teamList(headers)).rejects.toMatchObject({code:"PASSWORD_CHANGE_REQUIRED"});
 await expect(changeEmployeePassword(headers,{currentPassword:password,newPassword:password})).rejects.toMatchObject({code:"PASSWORD_MUST_DIFFER"});
 await expect(changeEmployeePassword(headers,{currentPassword:nextPassword,newPassword:nextPassword+"!"})).rejects.toMatchObject({code:"CURRENT_PASSWORD_INCORRECT"});
 await changeEmployeePassword(headers,{currentPassword:password,newPassword:nextPassword});
 await expect(requireEmployee(headers)).rejects.toMatchObject({status:401});
 const fresh=await login(body.email,nextPassword);expect((await requireEmployee(fresh)).passwordChangeRequired).toBe(false);
 expect((await pool.query("SELECT count(*) FROM employee_command WHERE kind='password_changed'")).rows[0].count).toBe("1");
});
it("atomic password audit failure keeps old credentials, setup flag and existing session",async()=>{
 const body=create();await teamAction(owner,body);const headers=await login(body.email);
 await pool.query("CREATE FUNCTION reject_password_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='password_changed' THEN RAISE EXCEPTION 'audit failure'; END IF; RETURN NEW; END $$");await pool.query("CREATE TRIGGER reject_password_audit_test BEFORE INSERT ON employee_command FOR EACH ROW EXECUTE FUNCTION reject_password_audit_test()");
 try{await expect(changeEmployeePassword(headers,{currentPassword:password,newPassword:nextPassword})).rejects.toThrow();}finally{await pool.query("DROP TRIGGER reject_password_audit_test ON employee_command");await pool.query("DROP FUNCTION reject_password_audit_test()");}
 expect((await requireEmployee(headers,false,true)).passwordChangeRequired).toBe(true);await login(body.email);
});
it("edits roles/status with versions, immediate session revocation and disabled-login denial",async()=>{
 const body=create();await teamAction(owner,body);const headers=await login(body.email);await changeEmployeePassword(headers,{currentPassword:password,newPassword:nextPassword});const fresh=await login(body.email,nextPassword);
 const member=(await teamList(owner,body.email)).members[0],edit={id:randomUUID(),kind:"edit",targetId:member.id,name:member.name,roles:["preparation"],enabled:true,version:member.version};
 await teamAction(owner,edit);await expect(requireEmployee(fresh)).rejects.toMatchObject({status:401});await teamAction(owner,edit);
 await expect(teamAction(owner,{...edit,id:randomUUID()})).rejects.toMatchObject({code:"EDIT_CONFLICT"});
 await teamAction(owner,{...edit,id:randomUUID(),version:member.version+1,enabled:false});expect((await teamList(owner)).counts.disabled).toBe(1);
 const response=await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({email:body.email,password:nextPassword})}));expect(response.status).toBe(401);
});
it("protects the last password-established owner, including concurrent demotions",async()=>{
 const edit={id:randomUUID(),kind:"edit",targetId:ownerId,name:"Owner",roles:["preparation"],enabled:true,version:1};
 await expect(teamAction(owner,edit)).rejects.toMatchObject({code:"LAST_OWNER_REQUIRED"});
 const pending={...create(),roles:["owner"]};await teamAction(owner,pending);await expect(teamAction(owner,edit)).rejects.toMatchObject({code:"LAST_OWNER_REQUIRED"});
 const headers=await login(pending.email);await changeEmployeePassword(headers,{currentPassword:password,newPassword:nextPassword});
 const results=await Promise.allSettled([teamAction(owner,edit),teamAction(owner,{id:randomUUID(),kind:"edit",targetId:pending.targetId,name:"New Owner",roles:["delivery"],enabled:true,version:2})]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect((await pool.query("SELECT count(*) FROM \"user\" u JOIN employee_role r ON r.user_id=u.id WHERE u.enabled AND NOT u.must_change_password AND r.role='owner'")).rows[0].count).toBe("1");
});
it("rolls back account, credentials and roles when create audit fails",async()=>{
 const body=create();await pool.query("CREATE FUNCTION reject_employee_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failure'; END $$");await pool.query("CREATE TRIGGER reject_employee_audit_test BEFORE INSERT ON employee_command FOR EACH ROW EXECUTE FUNCTION reject_employee_audit_test()");
 try{await expect(teamAction(owner,body)).rejects.toThrow();}finally{await pool.query("DROP TRIGGER reject_employee_audit_test ON employee_command");await pool.query("DROP FUNCTION reject_employee_audit_test()");}
 expect((await pool.query('SELECT count(*) FROM "user" WHERE id=$1',[body.targetId])).rows[0].count).toBe("0");await teamAction(owner,body);
});
it("rejects forged roles, fields, secrets and cross-origin changes",async()=>{
 await expect(teamAction(owner,{...create(),roles:["developer"]})).rejects.toMatchObject({status:400});await expect(teamAction(owner,{...create(),mustChangePassword:false})).rejects.toMatchObject({status:400});
 const headers=new Headers(owner);headers.set("origin","https://evil.example.invalid");headers.set("content-type","application/json");expect((await POST(new Request(`${config.origin}/api/employee/team`,{method:"POST",headers,body:JSON.stringify(create())}))).status).toBe(403);
 await expect(changeEmployeePassword(owner,{currentPassword:password,newPassword:"short"})).rejects.toMatchObject({status:400});
});

it("keeps team and password administration closed in production",async()=>{
 const saved={APP_ENV:process.env.APP_ENV,APP_ORIGIN:process.env.APP_ORIGIN,DATABASE_URL:process.env.DATABASE_URL,PAYMENTS_MODE:process.env.PAYMENTS_MODE};
 try{process.env.APP_ENV="production";process.env.APP_ORIGIN="https://erp.example.invalid";process.env.DATABASE_URL=`postgresql://runtime:${password}@db.example.invalid/lisi_production?sslmode=verify-full`;process.env.PAYMENTS_MODE="disabled";
  await expect(teamList(owner)).rejects.toMatchObject({status:404});await expect(teamAction(owner,create())).rejects.toMatchObject({status:404});await expect(changeEmployeePassword(owner,{currentPassword:password,newPassword:nextPassword})).rejects.toMatchObject({status:404});
 }finally{Object.assign(process.env,saved);}
});
