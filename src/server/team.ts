import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { requireEmployee, lockEmployee } from "./employee";
import { requireOrdering, transaction, throttle } from "./order-db";
import { readConfig } from "./config";
import { checkKeys, idField, integerField, textField, booleanField } from "./catalog-input";
import { HttpError } from "./http";
import { isRole } from "./roles";
import type { TeamView } from "../team/types";

function passwordField(raw:Record<string,unknown>,key:string) {
 const value=raw[key];if(typeof value!=="string" || value.length<12 || value.length>128)throw new HttpError(400,"INVALID_PASSWORD_LENGTH");return value;
}
export async function teamList(headers:Headers,search="",after:string|null=null):Promise<TeamView>{
 requireOrdering();const who=await requireEmployee(headers);const query=search.trim();if(query.length>120)throw new HttpError(400,"INVALID_INPUT");const cursor=after?idField(after):null;
 return transaction(async client=>{
  await lockEmployee(client,who,["owner"]);
  const result=await client.query(`SELECT u.id,u.name,u.email,u.enabled,u.version,u.must_change_password AS "mustChangePassword",
   coalesce((SELECT jsonb_agg(role ORDER BY role) FROM employee_role WHERE user_id=u.id),'[]'::jsonb) AS roles,
   (SELECT count(*)::int FROM customer_order o WHERE o.evidence_mode='court_test' AND o.state NOT IN ('canceled','unpaid_handover')
    AND ((o.preparation_assignee_id=u.id AND (o.state='preparing' OR o.state='exception' AND coalesce(o.held_state,'preparing')='preparing')) OR (o.delivery_assignee_id=u.id AND o.state IN ('delivery_claimed','out_for_delivery','awaiting_handover','exception')))) AS "activeTasks"
   FROM "user" u WHERE ($1='' OR strpos(lower(u.name||' '||u.email),lower($1))>0)
   AND ($2::text IS NULL OR (u.email,u.id)>(SELECT email,id FROM "user" WHERE id=$2)) ORDER BY u.email,u.id LIMIT 51`,[query,cursor]);
  const counts=(await client.query("SELECT count(*)::int total,count(*) FILTER (WHERE enabled)::int active,count(*) FILTER (WHERE NOT enabled)::int disabled FROM \"user\"")).rows[0];
  const members=result.rows.slice(0,50);return {employee:{id:who.user.id,name:who.user.name},members,next:result.rows.length>50?members.at(-1)!.id:null,counts};
 });
}
export async function teamAction(headers:Headers,raw:Record<string,unknown>){
 requireOrdering();const who=await requireEmployee(headers,true),kind=raw.kind;
 if(kind!=="create"&&kind!=="edit")throw new HttpError(400,"INVALID_INPUT");
 checkKeys(raw,["id","targetId","kind","name","roles",...(kind==="create"?["email","password"]:["version","enabled"])]);
 const id=idField(raw.id),targetId=idField(raw.targetId),name=textField(raw,"name",120);
 if(!Array.isArray(raw.roles)||!raw.roles.length||raw.roles.length>5||raw.roles.some(role=>typeof role!=="string"||!isRole(role)))throw new HttpError(400,"INVALID_INPUT");
 const roles=[...new Set(raw.roles as string[])].sort(),password=kind==="create"?passwordField(raw,"password"):null;
 const email=kind==="create"?textField(raw,"email",254).toLowerCase():null;
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,"INVALID_INPUT");
 const version=kind==="edit"?integerField(raw,"version",1):null,enabled=kind==="edit"?booleanField(raw,"enabled"):true;
 const canonical={id,targetId,kind,name,roles,email,password,version,enabled};
 // Keyed digest binds retries without retaining a brute-forceable password digest or plaintext.
 const digest=createHmac("sha256",readConfig().authSecret).update(JSON.stringify({...canonical,actor:who.user.id})).digest("hex");
 await transaction(async client=>{await lockEmployee(client,who,["owner"]);await throttle(client,`team:${who.user.id}`,30);});
 const hashed=password?await hashPassword(password):null;
 try{return await transaction(async client=>{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('employee-management',0))");
  // Self-edits take the user lock exclusively before the session lock, matching authentication lock order.
  await lockEmployee(client,who,["owner"],false,targetId===who.user.id);
  const prior=(await client.query("SELECT digest FROM employee_command WHERE id=$1",[id])).rows[0];
  if(prior){if(prior.digest!==digest)throw new HttpError(409,"COMMAND_ID_REUSED");return {accepted:true,replayed:true,targetId};}
  const before=(await client.query("SELECT id,enabled,version,must_change_password FROM \"user\" WHERE id=$1 FOR UPDATE",[targetId])).rows[0];
  let oldRoles:string[]=[];
  if(kind==="create"){
   if(before)throw new HttpError(409,"ALREADY_EXISTS");
   await client.query('INSERT INTO "user" (id,name,email,enabled,must_change_password) VALUES ($1,$2,$3,true,true)',[targetId,name,email]);
   await client.query("INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",[randomUUID(),targetId,hashed]);
  }else{
   if(!before)throw new HttpError(404,"NOT_FOUND");if(before.version!==version)throw new HttpError(409,"EDIT_CONFLICT");
   oldRoles=(await client.query("SELECT role FROM employee_role WHERE user_id=$1 ORDER BY role",[targetId])).rows.map(r=>r.role);
   if(before.enabled&&!before.must_change_password&&oldRoles.includes("owner")&&(!enabled||!roles.includes("owner"))){
    const others=await client.query(`SELECT 1 FROM "user" u JOIN employee_role r ON r.user_id=u.id WHERE u.id<>$1 AND u.enabled AND NOT u.must_change_password AND r.role='owner'`,[targetId]);
    if(!others.rowCount)throw new HttpError(409,"LAST_OWNER_REQUIRED");
   }
   await client.query('UPDATE "user" SET name=$2,enabled=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$1',[targetId,name,enabled]);
   await client.query("DELETE FROM employee_role WHERE user_id=$1",[targetId]);
   // Current capabilities must not survive any administrative edit.
   await client.query("DELETE FROM session WHERE user_id=$1",[targetId]);
  }
  for(const role of roles)await client.query("INSERT INTO employee_role (user_id,role) VALUES ($1,$2)",[targetId,role]);
  await client.query("INSERT INTO employee_command (id,actor_id,target_id,kind,digest,detail) VALUES ($1,$2,$3,$4,$5,$6)",
   [id,who.user.id,targetId,kind,digest,JSON.stringify({before:before?{enabled:before.enabled,roles:oldRoles,version:before.version}:null,after:{enabled,roles,version:(before?.version??0)+1},revoked:kind==="edit"})]);
  return {accepted:true,replayed:false,targetId};
 });}catch(error){if(error&&typeof error==="object"&&"code"in error&&error.code==="23505")throw new HttpError(409,"ALREADY_EXISTS");throw error;}
}
export async function changeEmployeePassword(headers:Headers,raw:Record<string,unknown>){
 requireOrdering();checkKeys(raw,["currentPassword","newPassword"]);
 const current=passwordField(raw,"currentPassword"),next=passwordField(raw,"newPassword");if(current===next)throw new HttpError(400,"PASSWORD_MUST_DIFFER");
 const who=await requireEmployee(headers,true,true);
 await transaction(async client=>{await lockEmployee(client,who,[],true);await throttle(client,`password:${who.user.id}`,10);});
 const hash=await hashPassword(next);
 return transaction(async client=>{
  await lockEmployee(client,who,[],true,true);
  const account=(await client.query("SELECT id,password FROM account WHERE user_id=$1 AND provider_id='credential' FOR UPDATE",[who.user.id])).rows[0];
  if(!account||!await verifyPassword({hash:account.password,password:current}))throw new HttpError(400,"CURRENT_PASSWORD_INCORRECT");
  await client.query("UPDATE account SET password=$2,updated_at=clock_timestamp() WHERE id=$1",[account.id,hash]);
  await client.query('UPDATE "user" SET must_change_password=false,version=version+1,updated_at=clock_timestamp() WHERE id=$1',[who.user.id]);
  await client.query("INSERT INTO employee_command (id,actor_id,target_id,kind,digest,detail) VALUES ($1,$2,$2,'password_changed','redacted','{}')",[randomUUID(),who.user.id]);
  await client.query("DELETE FROM session WHERE user_id=$1",[who.user.id]);
  return {changed:true,signInRequired:true};
 });
}
