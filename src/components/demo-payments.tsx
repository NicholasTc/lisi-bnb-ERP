"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OrderDetails } from "./order-status";
import { formatIdr } from "../catalog/types";
import { postJson, RequestError } from "../ordering/client";
import type { DemoPayload, StaffOrder } from "../ordering/types";
type Summary = { id: string; customerName: string; state: string; totalIdr: number };
type Command = { action: string; body: object };
export function DemoPayments() {
  const [orders, setOrders] = useState<Summary[]>([]), [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffOrder | null>(null), [identity, setIdentity] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState("");
  const [pending, setPending] = useState<Command | null>(null), [reason, setReason] = useState("");
  const refresh = useCallback(async (older?: string) => {
    try {
      const me = await fetch("/api/employee/me", { cache: "no-store" });
      if (!me.ok) throw new RequestError("UNAUTHENTICATED");
      const who = await me.json();
      if (!who.roles.some((role: string) => role === "owner" || role === "supervisor")) throw new RequestError("FORBIDDEN");
      setIdentity(who.user.id);
      const response = await fetch(`/api/employee/orders${older ? `?before=${older}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new RequestError("UNAVAILABLE");
      const value = await response.json(); setOrders(old => older ? [...old, ...value.orders] : value.orders); setNext(value.next);
      try { setPending(JSON.parse(sessionStorage.getItem(`lisi-demo-command:${who.user.id}`) ?? "null")); } catch { /* No pending test command. */ }
      setMessage("");
    } catch { setIdentity(""); setSelected(null); setOrders([]); setMessage("Owner/supervisor access is required and the demo service must be available. Sign in or retry shortly."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!identity) return;
    let last = 0;
    const deny = () => { setIdentity(""); setSelected(null); setOrders([]); setMessage("Employee access ended. Sign in again."); };
    const activity = () => {
      if (Date.now() - last < 10_000) return; last = Date.now();
      void fetch("/api/employee/activity", { method: "POST" }).then(response => { if (!response.ok) deny(); }).catch(deny);
    };
    const timer = setInterval(() => { void fetch("/api/employee/me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return deny(); const who = await response.json();
      if (!who.roles.some((role: string) => role === "owner" || role === "supervisor")) deny();
    }).catch(deny); }, 30_000);
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity);
    return () => { clearInterval(timer); window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); };
  }, [identity]);
  async function read(id: string) {
    setBusy(true); setMessage("");
    try { setSelected(await postJson<StaffOrder>("/api/employee/orders/read", { id })); }
    catch { setMessage("Order details are unavailable. Refresh and check your access."); }
    finally { setBusy(false); }
  }
  async function command(action: string, body: object) {
    const value = pending ?? { action, body };
    setBusy(true); setMessage("");
    try { sessionStorage.setItem(`lisi-demo-command:${identity}`, JSON.stringify(value)); setPending(value); }
    catch { setBusy(false); setMessage("Browser storage is required for safe test-command retries."); return; }
    try {
      const result = await postJson<{ result?: string; processed?: number }>(`/api/employee/orders/${value.action}`, value.body);
      sessionStorage.removeItem(`lisi-demo-command:${identity}`); setPending(null);
      await refresh();
      if (selected) setSelected(await postJson<StaffOrder>("/api/employee/orders/read", { id: selected.id }));
      setMessage(result.result ? `Demo result: ${result.result}` : result.processed !== undefined ? `Reconciled ${result.processed} event(s).` : "Action recorded. Review the current order below.");
    } catch (error) {
      if (error instanceof RequestError && error.status >= 400 && error.status < 500) {
        sessionStorage.removeItem(`lisi-demo-command:${identity}`); setPending(null);
        setMessage(`Action rejected: ${error.code}. Refresh the order before trying again.`);
      } else setMessage("Result uncertain. Retry the same command or inspect the recorded order; do not create a replacement action.");
    } finally { setBusy(false); }
  }
  function issue(changes: Partial<DemoPayload> = {}, deliver = true) {
    if (!selected?.demoTransactionId) return;
    const payload: DemoPayload = { eventId: crypto.randomUUID(), orderId: selected.id, transactionId: selected.demoTransactionId,
      flow: "payment", status: "succeeded", amountIdr: selected.totalIdr, currency: "IDR", ...changes };
    void command("event", { payload, deliver });
  }
  return <main className="staff-catalog"><header className="staff-header"><div><Link href="/employee/sign-in">Employee access / sign out</Link><h1>Demo payment controls</h1></div><Link href="/">Court ordering</Link></header>
    <p className="order-demo">Simulation only. No funds move. No QRIS payment or real merchant connection is enabled.</p>
    {message && <p className="staff-alert" role="status">{message}</p>}
    {loading ? <p role="status">Checking access…</p> : identity && <>
      <div className="staff-toolbar"><button className="staff-button" disabled={busy || !!pending} onClick={() => { void refresh(); }}>Refresh orders</button>
        <button className="staff-button" disabled={busy || !!pending} onClick={() => { void command("reconcile", {}); }}>Reconcile undelivered events</button>
        {pending && <button className="staff-button primary" disabled={busy} onClick={() => { void command(pending.action, pending.body); }}>Retry same command</button>}</div>
      <p className="staff-hint">Open a customer order in another tab, then refresh here. These controls are restricted to owners/supervisors in local demo mode.</p>
      <section className="demo-order-list" aria-label="Demo orders">{!orders.length && <p className="staff-empty">No historical demo orders. New court orders do not use payment simulation.</p>}
        {orders.map(order => <button className="demo-order-button" key={order.id} disabled={busy || !!pending} onClick={() => { void read(order.id); }}>
          <strong>{order.customerName}</strong><span>{order.id}</span><span>{order.state} · {formatIdr(order.totalIdr)}</span></button>)}
      </section>
      {next && <button className="staff-button mt-4" disabled={busy || !!pending} onClick={() => { void refresh(next); }}>Load older orders</button>}
      {selected && <section className="demo-order-detail" aria-label="Selected demo order"><OrderDetails order={selected} language="en" />
        <fieldset disabled={busy || !!pending} className="demo-controls"><legend>Simulate payment evidence</legend>
          <button className="staff-button primary" onClick={() => issue()}>Simulate successful payment</button>
          <button className="staff-button" onClick={() => issue({ status: "pending" })}>Simulate pending</button>
          <button className="staff-button" onClick={() => issue({ status: "failed" })}>Simulate failure</button>
          <button className="staff-button" onClick={() => issue({ status: "expired" })}>Simulate expiry</button>
          <button className="staff-button" onClick={() => issue({}, false)}>Store success without delivery</button>
          <button className="staff-button" onClick={() => issue({ transactionId: crypto.randomUUID() })}>Simulate extra payment</button>
          <button className="staff-button" onClick={() => issue({ transactionId: crypto.randomUUID(), amountIdr: selected.totalIdr === 2147483647 ? selected.totalIdr - 1 : selected.totalIdr + 1 })}>Simulate amount mismatch</button>
          <label className="demo-reason">Cancellation/refund reason<input value={reason} maxLength={200} onChange={event => setReason(event.target.value)} /></label>
          {selected.state === "awaiting_payment" && <button className="staff-button" disabled={!reason.trim()} onClick={() => { void command("cancel", { id: selected.id, reason }); }}>Cancel unpaid order</button>}
        </fieldset>
        <h2 className="mt-8 text-xl font-bold">Recorded payments & full refunds</h2>
        {selected.payments.map(payment => <article className="order-panel" key={payment.id}><h3 className="font-bold">{formatIdr(payment.amountIdr)} · {payment.primary ? "Accepted payment" : "Review / extra payment"}</h3><p className="order-reference">{payment.id}</p>
          <button className="staff-button mt-4" disabled={busy || !!pending || !reason.trim() || payment.refunds.some(refund => refund.state !== "failed")} onClick={() => { void command("refund", { id: crypto.randomUUID(), orderId: selected.id, paymentId: payment.id, reason }); }}>Request full simulated refund</button>
          {payment.refunds.map(refund => <div className="demo-refund" key={refund.id}><p>Refund {refund.id} · {refund.state}</p>
            {refund.state === "pending" && <div className="staff-record-actions">
              <button className="staff-button" disabled={busy || !!pending} onClick={() => issue({ flow: "refund", transactionId: refund.id, amountIdr: refund.amountIdr })}>Simulate refund success</button>
              <button className="staff-button" disabled={busy || !!pending} onClick={() => issue({ flow: "refund", transactionId: refund.id, amountIdr: refund.amountIdr, status: "failed" })}>Simulate refund failure</button>
              <button className="staff-button" disabled={busy || !!pending} onClick={() => issue({ flow: "refund", transactionId: refund.id, amountIdr: refund.amountIdr, status: "pending" })}>Keep outcome unknown</button>
            </div>}
          </div>)}
        </article>)}
        <h2 className="mt-8 text-xl font-bold">Demo provider inbox</h2>
        {selected.inbox.map(event => <article className="staff-record" key={event.id}><div><p>{event.payload.flow} / {event.payload.status} · {event.result ?? "Not delivered"}</p><p className="order-reference">{event.id}</p></div>
          <button className="staff-button" disabled={busy || !!pending} onClick={() => { void command("deliver", { eventId: event.id }); }}>{event.result ? "Replay event" : "Deliver event"}</button></article>)}
      </section>}
    </>}
  </main>;
}
