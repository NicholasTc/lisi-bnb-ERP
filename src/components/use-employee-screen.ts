"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {postJson,RequestError} from "../ordering/client";
/** Shared lifecycle for the two new staff screens; background reads never count as activity. */
export function useEmployeeScreen<T extends {employee:{id:string}}>(url:string,storagePrefix?:string){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[pending,setPending]=useState<Record<string,unknown>|null>(null),[lastSuccess,setLastSuccess]=useState(0),[now,setNow]=useState(0);
 const generation=useRef(0),inFlight=useRef(false),acting=useRef(false),identity=useRef<string|null>(null),activityAt=useRef(0),fetchTicket=useRef(0),activeController=useRef<AbortController|null>(null);
 const invalidate=useCallback(()=>{generation.current++;fetchTicket.current++;activeController.current?.abort();inFlight.current=false;},[]);
 const key=useCallback(()=>`${storagePrefix}:${identity.current}`,[storagePrefix]);
 const revoke=useCallback(()=>{generation.current++;setData(null);setPending(null);setDenied(true);setMessage("ACCESS_ENDED");if(storagePrefix){try{sessionStorage.removeItem(key());}catch{/* Server access is revoked. */}}identity.current=null;},[storagePrefix,key]);
 const refresh=useCallback(async()=>{
  if(inFlight.current||acting.current)return;inFlight.current=true;const ticket=++fetchTicket.current,version=generation.current,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  activeController.current=controller;
  try{const response=await fetch(url,{cache:"no-store",signal:controller.signal});if(version!==generation.current)return;
   if(response.status===401||response.status===403){revoke();return;}if(!response.ok)throw Error("Unavailable");const value:T=await response.json();if(version!==generation.current)return;
   if(identity.current!==value.employee.id){identity.current=value.employee.id;setPending(null);if(storagePrefix){try{const body=JSON.parse(sessionStorage.getItem(key())??"null");if(body&&typeof body.id==="string")setPending(body);}catch{/* Optional command recovery only. */}}}
   setData(value);setDenied(false);setLastSuccess(Date.now());setMessage(current=>current==="NETWORK"?"":current);
  }catch{if(version===generation.current)setMessage("NETWORK");}finally{clearTimeout(timeout);if(ticket===fetchTicket.current)inFlight.current=false;if(version===generation.current)setLoading(false);}
 },[url,revoke,storagePrefix,key]);
 useEffect(()=>{generation.current++;const initial=setTimeout(()=>{setData(null);setLastSuccess(0);setLoading(true);void refresh();},0),poll=setInterval(()=>{void refresh();},5000),clock=setInterval(()=>setNow(Date.now()),1000);return()=>{invalidate();clearTimeout(initial);clearInterval(poll);clearInterval(clock);};},[refresh,invalidate]);
 useEffect(()=>{if(!data||denied)return;const activity=()=>{if(Date.now()-activityAt.current<10000)return;activityAt.current=Date.now();const version=generation.current;void fetch("/api/employee/activity",{method:"POST"}).then(response=>{if(version===generation.current&&(response.status===401||response.status===403))revoke();}).catch(()=>{});};window.addEventListener("pointerdown",activity);window.addEventListener("keydown",activity);return()=>{window.removeEventListener("pointerdown",activity);window.removeEventListener("keydown",activity);};},[data,denied,revoke]);
 async function send(body:Record<string,unknown>){
  if(acting.current||!identity.current)return false;
  if(storagePrefix){try{sessionStorage.setItem(key(),JSON.stringify(body));}catch{setMessage("STORAGE");return false;}}
  acting.current=true;generation.current++;const version=generation.current;setBusy(true);setPending(body);setLastSuccess(0);setMessage("");
  try{await postJson(url.split("?")[0],body);if(version!==generation.current)return false;
   if(storagePrefix)sessionStorage.removeItem(key());setPending(null);setMessage("SAVED");return true;
  }catch(error){if(version!==generation.current)return false;
   if(error instanceof RequestError&&(error.status===401||["FORBIDDEN","PASSWORD_CHANGE_REQUIRED"].includes(error.code))){revoke();return false;}
   if(error instanceof RequestError&&error.status>=400&&error.status<500){if(storagePrefix)sessionStorage.removeItem(key());setPending(null);setMessage(error.code);}else setMessage("UNCERTAIN");return false;
  }finally{acting.current=false;setBusy(false);void refresh();}
 }
 const stale=!lastSuccess||now-lastSuccess>=15000;
 return {data,loading,denied,busy,pending,message,stale,refresh,send,blocked:busy||!!pending||stale};
}
