"use client";
import {useState} from "react";
import Link from "next/link";
import {useEmployeeScreen} from "./use-employee-screen";
import {StaffFrame,staffError} from "./staff-frame";
import {useLanguage} from "../ordering/client";
import {roles,type Role} from "../server/roles";
import type {TeamView,TeamMember} from "../team/types";
const roleNames:Record<Role,[string,string]>={owner:["Owner","Pemilik"],preparation:["Preparation","Persiapan"],delivery:["Delivery","Pengantaran"],supervisor:["Supervisor","Supervisor"],counter:["Counter","Kasir"]};
export function TeamManagement(){
 const [language,change]=useLanguage(),en=language==="en",[search,setSearch]=useState(""),[cursor,setCursor]=useState<string|null>(null),[editor,setEditor]=useState<TeamMember|"new"|null>(null);
 const screen=useEmployeeScreen<TeamView>(`/api/employee/team?search=${encodeURIComponent(search)}${cursor?`&after=${cursor}`:""}`),data=screen.data;
 return <StaffFrame language={language} change={change} title={en?"Your café team.":"Tim kafemu."} lead={en?"Individual accounts. Clear responsibilities.":"Akun pribadi. Tanggung jawab yang jelas."}>
 <div className="prep-tools"><button className="prep-button" disabled={screen.busy} onClick={()=>{void screen.refresh();}}>{en?"Refresh":"Muat ulang"}</button>{data&&<button className="prep-button primary" disabled={screen.blocked} onClick={()=>setEditor("new")}>{en?"Add employee":"Tambah staf"}</button>}</div>
 {screen.message&&<p className="prep-notice" role={screen.message==="SAVED"?"status":"alert"}>{staffError(screen.message,en)}</p>}
 {screen.denied?<Link className="prep-button" href="/employee/sign-in">{en?"Employee sign in":"Masuk staf"}</Link>:<>
 {screen.pending&&<div className="prep-notice"><button className="prep-button" disabled={screen.busy||screen.stale} onClick={()=>{void screen.send(screen.pending!).then(ok=>{if(ok)setEditor(null);});}}>{en?"Retry same action":"Ulangi tindakan yang sama"}</button></div>}
 {screen.stale&&!screen.loading&&<p className="prep-notice" role="alert">{en?"Data is stale. Refresh before making changes.":"Data belum mutakhir. Muat ulang sebelum mengubah."}</p>}
 {data&&<p className="team-counts">{data.counts.total} {en?"accounts":"akun"} · {data.counts.active} {en?"active":"aktif"} · {data.counts.disabled} {en?"disabled":"nonaktif"}</p>}
 <form className="team-search" onSubmit={event=>{event.preventDefault();setSearch(String(new FormData(event.currentTarget).get("search")??""));setCursor(null);setEditor(null);}}><label>{en?"Find an employee":"Cari staf"}<input name="search" maxLength={120} placeholder={en?"Name or email":"Nama atau email"}/></label><button className="prep-button" disabled={screen.busy}>{en?"Search":"Cari"}</button></form>
 {editor&&data&&<TeamEditor key={typeof editor==="string"?"new":editor.id} value={editor} en={en} blocked={screen.blocked} cancel={()=>setEditor(null)} save={body=>{void screen.send(body).then(ok=>{if(ok)setEditor(null);});}}/>}
 {screen.loading&&!data?<p role="status">{en?"Loading accounts…":"Memuat akun…"}</p>:data&&<section aria-label="Employee accounts" className="team-list">{!data.members.length&&<p className="prep-empty">{en?"No matching accounts.":"Tidak ada akun yang cocok."}</p>}{data.members.map(member=><article className="team-person" key={member.id}>
 <div><h2>{member.name}</h2><p>{member.email}</p><p>{member.roles.map(role=>roleNames[role]?.[en?0:1]??role).join(" · ")}</p><p><strong>{member.enabled?(en?"Active":"Aktif"):(en?"Disabled":"Nonaktif")}</strong>{member.mustChangePassword&&(en?" · Password setup required":" · Perlu mengatur kata sandi")}</p>{member.activeTasks>0&&<p>{member.activeTasks} {en?"assigned tasks need physical review before access changes":"tugas perlu diperiksa secara fisik sebelum perubahan akses"}</p>}</div>
 <button className="prep-button" disabled={screen.blocked} aria-label={`${en?"Edit":"Edit"} ${member.name}`} onClick={()=>setEditor(member)}>{en?"Manage access":"Atur akses"}</button></article>)}</section>}
 {data&&<div className="prep-pagination">{cursor&&<button className="prep-button" onClick={()=>setCursor(null)}>{en?"First accounts":"Akun pertama"}</button>}{data.next&&<button className="prep-button" onClick={()=>setCursor(data.next)}>{en?"Next accounts":"Akun berikutnya"}</button>}</div>}
 </>}
 </StaffFrame>;
}
function TeamEditor({value,en,blocked,cancel,save}:{value:TeamMember|"new";en:boolean;blocked:boolean;cancel:()=>void;save:(body:Record<string,unknown>)=>void}){
 const create=value==="new",member=create?null:value,[id]=useState(()=>crypto.randomUUID()),[targetId]=useState(()=>member?.id??crypto.randomUUID());
 return <form className="team-editor" aria-label={create?"Add employee":"Edit employee"} onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),enabled=create||data.has("enabled");
  if(!create&&!enabled&&!window.confirm(en?"Disable access and revoke all sessions? Check any assigned work first.":"Nonaktifkan akses dan semua sesi? Periksa tugas yang ditugaskan terlebih dahulu."))return;
  save({id,targetId,kind:create?"create":"edit",name:data.get("name"),roles:data.getAll("roles"),...(create?{email:data.get("email"),password:data.get("password")}:{version:member!.version,enabled})});
 }}><h2>{create?(en?"Add employee":"Tambah staf"):(en?"Manage access":"Atur akses")}</h2><fieldset disabled={blocked}>
 <label>{en?"Employee name":"Nama staf"}<input name="name" required maxLength={120} defaultValue={member?.name}/></label>
 {create?<><label>Email<input name="email" type="email" required maxLength={254} autoComplete="off"/></label><label>{en?"Temporary password":"Kata sandi sementara"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><p>{en?"Give this privately. The employee must change it before using staff tools. It cannot be retrieved later.":"Berikan secara pribadi. Staf wajib menggantinya sebelum menggunakan alat staf. Kata sandi tidak dapat dilihat kembali."}</p></>:<p>{member?.email}</p>}
 <fieldset className="team-roles"><legend>{en?"Roles — select at least one":"Peran — pilih minimal satu"}</legend>{roles.map(role=><label key={role}><input type="checkbox" name="roles" value={role} defaultChecked={member?.roles.includes(role)??false}/>{roleNames[role][en?0:1]}</label>)}</fieldset>
 {!create&&<label><input type="checkbox" name="enabled" defaultChecked={member!.enabled}/>{en?"Account enabled":"Akun aktif"}</label>}
 {!create&&<p>{en?"Saving revokes this employee’s sessions. Order history and task ownership are preserved; reassign work after checking physical progress.":"Menyimpan akan mengakhiri sesi staf. Riwayat dan tugas tetap tersimpan; alihkan tugas setelah pemeriksaan fisik."}</p>}
 <div className="prep-tools"><button className="prep-button primary">{en?"Save account":"Simpan akun"}</button><button className="prep-button" type="button" onClick={cancel}>{en?"Cancel":"Batal"}</button></div></fieldset></form>;
}
