"use client";
import {useState} from "react";
import Link from "next/link";
export function PasswordChange({onChanged}:{onChanged?:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);
  if(data.get("newPassword")!==data.get("confirmPassword")){setMessage("The new passwords do not match.");return;}
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/employee/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword:data.get("currentPassword"),newPassword:data.get("newPassword")})});
   const value=await response.json();
   if(response.ok){form.reset();setDone(true);onChanged?.();}
   else setMessage(value.error?.code==="CURRENT_PASSWORD_INCORRECT"?"Current password is incorrect.":value.error?.code==="PASSWORD_MUST_DIFFER"?"Choose a different password.":response.status===401?"Your session ended. Sign in again.":response.status===429?"Too many attempts. Wait a minute.":"Password change was not confirmed. Try signing in with your new password before retrying.");
  }catch{setMessage("Connection lost. The result is uncertain; try signing in with your new password before retrying.");}
  finally{setBusy(false);}
 }
 if(done)return <section role="status"><p>Password changed. Sign in again with your new password.</p><Link className="mt-4 block underline" href="/employee/sign-in">Employee sign in</Link></section>;
 return <form onSubmit={submit} className="mt-6 space-y-4" aria-label="Change employee password">
  <h2 className="text-xl font-bold">Choose your own password</h2><p className="text-sm">Use 12–128 characters. Changing it signs out every session, including this device.</p>
  <label className="block">Current / temporary password<input className="mt-2 block min-h-12 w-full rounded-md border bg-white px-3" name="currentPassword" type="password" autoComplete="current-password" required minLength={12} maxLength={128} disabled={busy}/></label>
  <label className="block">New password<input className="mt-2 block min-h-12 w-full rounded-md border bg-white px-3" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy}/></label>
  <label className="block">Confirm new password<input className="mt-2 block min-h-12 w-full rounded-md border bg-white px-3" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy}/></label>
  <button className="min-h-12 rounded-full bg-[#c9351f] px-6 font-bold text-white" disabled={busy}>{busy?"Changing…":"Change password"}</button>{message&&<p role="alert">{message}</p>}
 </form>;
}
