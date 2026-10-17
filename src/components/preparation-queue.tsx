"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, RequestError, useLanguage } from "../ordering/client";
import { preparationStates, type PreparationCommand, type PreparationQueue, type PreparationState } from "../preparation/types";
import { preparationCopy } from "../preparation/copy";

export function PreparationQueueScreen() {
  const [language, change] = useLanguage(), t = preparationCopy[language];
  const [queue, setQueue] = useState<PreparationQueue | null>(null), [tab, setTab] = useState<PreparationState>("awaiting_preparation");
  const [after, setAfter] = useState<string | null>(null), [message, setMessage] = useState("");
  const [denied, setDenied] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PreparationCommand | null>(null), [lastSuccess, setLastSuccess] = useState(0), [now, setNow] = useState(0);
  const [sound, setSound] = useState(false), [soundError, setSoundError] = useState(false);
  const generation = useRef(0), fetching = useRef(false), acting = useRef(false), lastActivity = useRef(0);
  const identity = useRef<string | null>(null), audio = useRef<AudioContext | null>(null), latestOrder = useRef<string | null | undefined>(undefined);
  const storageKey = useCallback(() => `lisi-preparation-command:${identity.current}`, []);
  const revoke = useCallback(() => {
    generation.current++; identity.current = null; latestOrder.current = undefined;
    setQueue(null); setPending(null); setDenied(true); setMessage("");
    try { for (let i=sessionStorage.length-1;i>=0;i--) { const key=sessionStorage.key(i); if (key?.startsWith("lisi-preparation-command:")) sessionStorage.removeItem(key); } } catch { /* Server authorization remains authoritative. */ }
    void audio.current?.close().catch(() => {}); audio.current = null; setSound(false);
  }, []);
  const refresh = useCallback(async () => {
    if (fetching.current || acting.current) return;
    fetching.current = true; const version = generation.current;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`/api/employee/preparation?state=${tab}${after ? `&after=${after}` : ""}`, { cache: "no-store", signal: controller.signal });
      if (version !== generation.current) return;
      if (response.status === 401 || response.status === 403) { revoke(); return; }
      if (!response.ok) throw new Error("Unavailable");
      const value: PreparationQueue = await response.json();
      if (version !== generation.current) return;
      if (identity.current !== value.employee.id) {
        identity.current = value.employee.id; latestOrder.current = undefined; setPending(null);
        try {
          const saved = JSON.parse(sessionStorage.getItem(storageKey()) ?? "null");
          if (saved && typeof saved.id === "string") setPending(saved);
        } catch { /* Storage failure only prevents recovery across a reload. */ }
      }
      if (latestOrder.current !== undefined && value.latestOrderId !== latestOrder.current && audio.current?.state === "running") {
        try { const oscillator=audio.current.createOscillator(), gain=audio.current.createGain(); oscillator.connect(gain); gain.connect(audio.current.destination); oscillator.frequency.value=660; gain.gain.setValueAtTime(0.08,audio.current.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,audio.current.currentTime+0.25); oscillator.start(); oscillator.stop(audio.current.currentTime+0.25); } catch { setSoundError(true); }
      }
      latestOrder.current = value.latestOrderId;
      setQueue(value); setDenied(false); setLastSuccess(Date.now()); setMessage(current => current === "offline" ? "" : current);
    } catch { if (version === generation.current) setMessage("offline"); }
    finally { clearTimeout(timeout); fetching.current=false; if (version === generation.current) setLoading(false); }
  }, [tab, after, revoke, storageKey]);
  useEffect(() => {
    const initial=setTimeout(() => { void refresh(); },0), poll=setInterval(() => { void refresh(); },5000);
    const clock=setInterval(() => setNow(Date.now()),1000);
    return () => { clearTimeout(initial); clearInterval(poll); clearInterval(clock); };
  }, [refresh]);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);
  useEffect(() => {
    if (!queue || denied) return;
    const activity = () => {
      if (Date.now()-lastActivity.current < 10_000) return;
      lastActivity.current = Date.now(); const version=generation.current;
      void fetch("/api/employee/activity", {method:"POST"}).then(response => {
        if (version === generation.current && (response.status===401 || response.status===403)) revoke();
      }).catch(() => {});
    };
    window.addEventListener("pointerdown",activity); window.addEventListener("keydown",activity);
    return () => { window.removeEventListener("pointerdown",activity); window.removeEventListener("keydown",activity); };
  }, [queue, denied, revoke]);
  function selectTab(value: PreparationState, cursor: string | null = null) {
    generation.current++; setTab(value); setAfter(cursor); setQueue(null); setLoading(true); setLastSuccess(0); setMessage("");
  }
  async function act(command: PreparationCommand) {
    if (acting.current || !identity.current) return;
    try { sessionStorage.setItem(storageKey(),JSON.stringify(command)); }
    catch { setMessage("failed"); return; }
    acting.current=true; generation.current++; const version=generation.current;
    setPending(command); setBusy(true); setMessage(""); setLastSuccess(0);
    try {
      await postJson("/api/employee/preparation",command);
      if (version !== generation.current) return;
      sessionStorage.removeItem(storageKey()); setPending(null); setMessage("saved");
      if (command.kind === "claim") { setTab("preparing"); setAfter(null); }
      else if (command.kind === "ready") { setTab("ready"); setAfter(null); }
      else if (command.kind === "hold") { setTab("exception"); setAfter(null); }
    } catch (error) {
      if (version !== generation.current) return;
      if (error instanceof RequestError && (error.status===401 || error.status===403 && error.code === "FORBIDDEN")) { revoke(); return; }
      // Known rejected requests did not commit; ambiguous network/5xx responses retain the exact command.
      if (error instanceof RequestError && error.status>=400 && error.status<500) {
        sessionStorage.removeItem(storageKey()); setPending(null);
        setMessage(error.status===409 ? "changed" : error.status===403 ? "forbidden" : "invalid");
      } else setMessage("pending");
    } finally { acting.current=false; setBusy(false); if (command.kind === "pause" || command.kind === "resume") void refresh(); }
  }
  async function toggleSound() {
    try {
      if (audio.current) { await audio.current.close(); audio.current=null; setSound(false); return; }
      const context=new AudioContext(); audio.current=context; await context.resume();
      setSound(context.state === "running"); setSoundError(context.state !== "running");
    } catch { setSoundError(true); }
  }
  const stale = !lastSuccess || now-lastSuccess>=15_000;
  const blocked = busy || !!pending || stale || !queue?.employee.canWork;
  return <main className="prep-app">
    <header className="prep-header"><Link className="prep-brand" href="/">LISI <span>BNB</span></Link><div className="prep-language" aria-label="Language"><button aria-pressed={language==="id"} onClick={()=>change("id")}>ID</button><button aria-pressed={language==="en"} onClick={()=>change("en")}>EN</button></div></header>
    <nav className="prep-links" aria-label="Employee navigation"><Link href="/employee/sign-in">{t.access}</Link>{queue?.employee.canWork && <Link href="/employee/menu">{t.menu}</Link>}<Link href="/">{t.customer}</Link>{queue?.employee.canDeliver && <Link href="/employee/delivery">{language==="en"?"Delivery & recovery":"Pengantaran & pemulihan"}</Link>}{queue?.employee.canManageAccounts && <Link href="/employee/team">{language==="en"?"Team & accounts":"Tim & akun"}</Link>}</nav>
    <div className="prep-heading"><div><h1>{t.title}</h1><p>{t.lead}</p></div>{queue && <p className="prep-identity">{queue.employee.name}</p>}</div>
    <p className="prep-test">{t.test}</p>
    {denied ? <section className="prep-empty"><p role="alert">{t.session}</p><Link className="prep-button primary" href="/employee/sign-in">{t.signin}</Link></section> : <>
      {message && message!=="pending" && <p role={message==="saved" ? "status" : "alert"} className="prep-notice">{t[message] ?? t.failed}</p>}
      {queue && <section className={`prep-service ${queue.service.paused ? "is-paused" : ""}`} aria-label="Ordering service"><div><strong><span aria-hidden="true">{queue.service.paused ? "Ⅱ" : "●"}</span> {queue.service.paused ? t.paused : t.open}</strong>{queue.service.paused && <p>{queue.service.reason}</p>}<p>{queue.service.paused ? t.pauseNote : t.openNote}</p>{queue.service.deliveryPaused && <p>{t.deliveryPaused}</p>}</div>
        {queue.employee.canWork && (queue.service.paused ? <button className="prep-button" disabled={blocked} onClick={()=>{void act({id:crypto.randomUUID(),kind:"resume",version:queue.service.version});}}>{t.resume}</button> : <details><summary>{t.pause}</summary><ReasonForm label={t.reason} submit={t.pause} disabled={blocked} onSubmit={reason=>{void act({id:crypto.randomUUID(),kind:"pause",version:queue.service.version,reason});}} /></details>)}
      </section>}
      {pending && <section className="prep-notice" role="status"><p>{t.pending}</p><button className="prep-button primary" disabled={busy || stale || !queue?.employee.canWork} onClick={()=>{void act(pending);}}>{t.retry}</button><small>{t.stored}</small></section>}
      <div className="prep-toolbar"><div role="tablist" aria-label={language==="id" ? "Antrean persiapan" : "Preparation queues"}>{preparationStates.map(state=><button role="tab" aria-selected={tab===state} aria-controls="preparation-orders" id={`tab-${state}`} key={state} disabled={busy} onClick={()=>selectTab(state)}>{t[state]} <span>{queue?.counts[state] ?? "–"}</span></button>)}</div><div className="prep-tools"><button className="prep-button" disabled={busy} onClick={()=>{setMessage("");void refresh();}}>{t.refresh}</button><button className="prep-button" aria-pressed={sound} onClick={()=>{void toggleSound();}}>{sound ? t.mute : t.sound}</button></div></div>
      {soundError && <p className="prep-notice" role="status">{t.soundFailed}</p>}
      {stale && !loading && <p className="prep-notice" role="alert">{t.offline}</p>}
      {queue && !queue.employee.canWork && <p className="prep-notice">{t.viewOnly}</p>}
      <section id="preparation-orders" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {loading && !queue ? <p className="prep-empty" role="status">{t.loading}</p> : queue && !queue.orders.length ? <div className="prep-empty"><span aria-hidden="true">✓</span><h2>{t.empty}</h2><p>{t.emptyNote}</p></div> : <div className="prep-orders">{queue?.orders.map(order=><article className="prep-order" key={order.id} aria-label={order.reference}>
          <div className="prep-order-top"><span className="prep-reference">{order.reference}</span><time dateTime={order.createdAt}>{t.since} {new Intl.DateTimeFormat(language==="id" ? "id-ID" : "en-GB",{timeZone:"Asia/Jakarta",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(order.createdAt))}</time></div>
          <h2>{order.destination}</h2><p className="prep-customer">{order.customerName}</p>
          <ul className="prep-drinks">{order.items.map((item,index)=><li key={index}><span>{item.quantity}×</span><strong>{language==="en" ? item.nameEn || item.name : item.name}</strong></li>)}</ul>
          {order.assigneeName && <p className="prep-assignee">{order.assigneeId===queue.employee.id ? t.yours : `${t.claimed} ${order.assigneeName}`}</p>}
          {order.state==="ready" && <p className="prep-note">{t.readyNote}</p>}
          {order.state==="exception" && <div className="prep-note"><strong>{order.reason}</strong><p>{t.reviewed}</p></div>}
          {queue.employee.canWork && (order.state==="awaiting_preparation" || order.state==="preparing" && order.assigneeId===queue.employee.id) && <div className="prep-actions"><button className="prep-button primary" disabled={blocked} onClick={()=>{void act({id:crypto.randomUUID(),kind:order.state==="awaiting_preparation" ? "claim" : "ready",orderId:order.id});}}>{order.state==="awaiting_preparation" ? t.claim : t.finish}</button>
            <details><summary>{t.flag}</summary><ReasonForm label={t.reason} submit={t.hold} disabled={blocked} onSubmit={reason=>{void act({id:crypto.randomUUID(),kind:"hold",orderId:order.id,reason});}} /></details></div>}
        </article>)}</div>}
      </section>
      {queue && <footer className="prep-pagination"><p>{t.page}</p><div>{after && <button className="prep-button" disabled={busy} onClick={()=>selectTab(tab)}>{t.first}</button>}{queue.next && <button className="prep-button" disabled={busy} onClick={()=>selectTab(tab,queue.next)}>{t.next}</button>}</div></footer>}
    </>}
  </main>;
}
function ReasonForm({label, submit, disabled, onSubmit}: {label:string;submit:string;disabled:boolean;onSubmit:(reason:string)=>void}) {
  return <form className="prep-reason" onSubmit={event=>{event.preventDefault();const form=event.currentTarget, reason=String(new FormData(form).get("reason") ?? "").trim();if(reason)onSubmit(reason);}}>
    <label>{label}<textarea name="reason" required maxLength={200} disabled={disabled} rows={2}/></label><button className="prep-button" disabled={disabled}>{submit}</button>
  </form>;
}
