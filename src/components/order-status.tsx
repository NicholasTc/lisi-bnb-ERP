"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OrderShell } from "./order-shell";
import { formatIdr, type Language } from "../catalog/types";
import { errorText, orderCopy } from "../ordering/copy";
import { postJson, RequestError, useLanguage } from "../ordering/client";
import { rememberedOrders, rememberOrder, recoveryPath } from "../ordering/browser";
import type { OrderView } from "../ordering/types";

export function OrderDetails({ order, language }: { order: OrderView; language: Language }) {
  const t = orderCopy[language];
  if (order.workflow === "court_test") return <>
    <section className="order-state-card" aria-live="polite">
      <span className="order-status-icon" aria-hidden="true">{!(["exception", "canceled"].includes(order.state)) ? "✓" : "!"}</span>
      <h1 className="order-title">{t[order.state]}</h1>
      <p>{order.state === "awaiting_preparation" ? t.courtSaved : order.state === "preparing" ? t.preparationNote : order.state === "ready" ? t.readyNote : order.state === "canceled" ? t.closed : t[`${order.state}Note`] ?? t.courtReview}</p>
      <p className="order-reference">{t.reference} <strong>{order.reference}</strong></p>
    </section>
    <section className="order-panel order-overview"><p className="order-hint">{t.deliverTo}</p><p className="order-destination">{order.destination}</p>
      <div className="order-total"><strong>{t.total}</strong><strong>{formatIdr(order.totalIdr)}</strong></div>
      <p className="order-hint">{t.inclusive}</p>
    </section>
    <div className="order-pay-note"><strong>{t.unpaid}</strong><p>{order.state === "awaiting_preparation" ? t.courtQueued : t.payAtDeliveryNote}</p></div>
    <details className="order-details"><summary>{t.orderDetails} ({order.items.reduce((sum, item) => sum + item.quantity, 0)})</summary>
      {order.items.map(item => <div className="order-line" key={item.productId}><div><strong>{language === "en" ? item.nameEn || item.name : item.name}</strong><p>{item.quantity} × {formatIdr(item.unitPriceIdr)}</p></div><strong>{formatIdr(BigInt(item.quantity) * BigInt(item.unitPriceIdr))}</strong></div>)}
    </details>
    <p className="order-hint order-stage-note">{t.milestoneNote}</p>
  </>;
  return <>
    <h1 className="order-title">{t[order.state]}</h1>
    <p className="order-reference">{order.id}</p>
    <p className="order-destination">{t[order.kind]} · {order.destination}</p>
    <section className="order-panel" aria-label={t.cart}>
      {order.items.map(item => <div className="order-line" key={item.productId}><div><strong>{language === "en" ? item.nameEn || item.name : item.name}</strong><p>{item.quantity} × {formatIdr(item.unitPriceIdr)}</p></div><strong>{formatIdr(BigInt(item.quantity) * BigInt(item.unitPriceIdr))}</strong></div>)}
      <div className="order-total"><strong>{t.total}</strong><strong>{formatIdr(order.totalIdr)}</strong></div><p className="order-hint">{t.inclusive}</p>
    </section>
    <section className="order-panel"><h2>{t.payment}</h2><p className="order-payment-state">{t[order.paymentStatus]}</p>
      {order.paymentStatus === "unpaid" && order.state === "awaiting_payment" && order.expiresAt && <><p>{t.waitingTester}</p><p className="order-hint">{t.deadline}: {new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(order.expiresAt))} WIB</p></>}
      {order.state === "queued_for_preparation" && <p>{t.noPreparation}</p>}
      {order.state === "exception" && <p>{t.reviewNote}</p>}
      {order.state === "canceled" && <p>{t.closed}</p>}
      {order.receivedIdr !== "0" && <p className="order-hint">{t.receivedMoney}: {formatIdr(order.receivedIdr)}</p>}
      {order.refundedIdr !== "0" && <p className="order-hint">{t.refundedMoney}: {formatIdr(order.refundedIdr)}</p>}
    </section>
    {order.pickupCode && <p className="order-pickup">{t.pickupCode}: <strong>{order.pickupCode}</strong></p>}
  </>;
}
export function RecoveryLink({ id, accessKey, language }: { id: string; accessKey: string; language: Language }) {
  const t = orderCopy[language]; const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => { const timer = setTimeout(() => setUrl(`${window.location.origin}${recoveryPath(id, accessKey)}`), 0); return () => clearTimeout(timer); }, [id, accessKey]);
  return <details className="order-details order-recovery"><summary>{t.keepLink}</summary><p className="order-hint">{t.private}</p>
    <input className="order-link-input" aria-label={t.recovery} value={url} readOnly onFocus={event => event.target.select()} />
    <button className="menu-button mt-3" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? t.copied : t.copy}</button>
  </details>;
}
export function OrderStatus({ id }: { id: string }) {
  const [language, change] = useLanguage(), t = orderCopy[language];
  const [key, setKey] = useState(""), [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const sequence = useRef(0), inFlight = useRef(false), mutating = useRef(false);
  useEffect(() => {
    const selectAccess = () => {
      sequence.current++; inFlight.current = false; mutating.current = false;
      setOrder(null); setKey(""); setError(""); setLoading(true); setBusy(false);
      const fragment = window.location.hash.slice(1);
      const saved = rememberedOrders().find(value => value.id === id)?.accessKey;
      // An explicitly supplied bad key must never fall back to a previously saved good key.
      const access = fragment ? /^[a-f0-9]{64}$/.test(fragment) ? fragment : undefined : saved;
      if (access) setKey(access); else { setError("ORDER_NOT_FOUND"); setLoading(false); }
    };
    const timer = setTimeout(selectAccess, 0);
    window.addEventListener("hashchange", selectAccess);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", selectAccess); };
  }, [id]);
  const refresh = useCallback(async () => {
    if (!key || inFlight.current || mutating.current) return;
    inFlight.current = true;
    const version = ++sequence.current;
    try {
      const value = await postJson<OrderView>("/api/orders/read", { id, accessKey: key });
      if (version !== sequence.current) return;
      setOrder(value); setError("");
      try { rememberOrder(id, key, value.accessExpiresAt); } catch { /* The fragment still works if storage is unavailable. */ }
    } catch (error) { if (version === sequence.current) { setError(error instanceof RequestError ? error.code : "NETWORK"); if (error instanceof RequestError && error.status === 404) { setOrder(null); setKey(""); } } }
    finally { inFlight.current = false; if (version === sequence.current) setLoading(false); }
  }, [id, key]);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0), timer = setInterval(() => { void refresh(); }, 5000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  async function cancel() {
    if (mutating.current || !window.confirm(t.cancelConfirm)) return;
    mutating.current = true; setBusy(true); const version = ++sequence.current;
    try {
      const value = await postJson<OrderView>("/api/orders/cancel", { id, accessKey: key });
      if (version === sequence.current) { setOrder(value); setError(""); }
    }
    catch (error) { if (version === sequence.current) setError(error instanceof RequestError ? error.code : "NETWORK"); }
    finally { if (version === sequence.current) { mutating.current = false; setBusy(false); await refresh(); } }
  }
  return <OrderShell language={language} change={change}>
    {loading ? <p role="status" className="menu-status">{t.loading}</p> : <>
      {error && <p role="alert" className="menu-alert">{errorText(error, t)}</p>}
      {order && <><OrderDetails order={order} language={language} /><RecoveryLink id={id} accessKey={key} language={language} />
        {(order.state === "awaiting_payment" || order.state === "awaiting_preparation") && <button className="menu-button order-cancel" disabled={busy} onClick={() => { void cancel(); }}>{order.workflow === "court_test" ? t.cancelBeforeClaim : t.cancel}</button>}
      </>}
      <button className="menu-button mt-4" disabled={busy || !key} onClick={() => { void refresh(); }}>{language === "id" ? "Muat ulang status" : "Refresh status"}</button>
      {!order && <Link className="order-back ml-4" href="/">{t.back}</Link>}
    </>}
  </OrderShell>;
}
