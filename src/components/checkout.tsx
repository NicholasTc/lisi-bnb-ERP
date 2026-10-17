"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrderShell } from "./order-shell";
import { formatIdr, type PublicCatalog } from "../catalog/types";
import { errorText, orderCopy } from "../ordering/copy";
import { postJson, RequestError, useLanguage } from "../ordering/client";
import { clearPending, newAccessKey, readCart, readPending, recoveryPath, rememberOrder, saveCart, savePending, type CartLine } from "../ordering/browser";
import type { CheckoutInput, OrderView } from "../ordering/types";
const draftKey = "lisi-pending-court-v2";

export function Checkout() {
  const [language, change] = useLanguage(), t = orderCopy[language];
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null), [cart, setCart] = useState<CartLine[]>([]);
  const [pending, setPending] = useState<CheckoutInput | null>(null);
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [location, setLocation] = useState("");
  const [confirmed, setConfirmed] = useState(false), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/catalog${window.location.search}`, { cache: "no-store" });
      if (!response.ok) throw new RequestError("NETWORK");
      const data: PublicCatalog = await response.json(); setCatalog(data);
      const saved = readPending(draftKey); setPending(saved); setCart(readCart());
      if (saved) { setName(saved.customerName); setPhone(saved.phone ?? ""); setLocation(saved.locationId ?? ""); setConfirmed(saved.locationConfirmed); }
      else setLocation(data.qr.courtId ?? "");
      setError(!data.orderingEnabled ? "ORDERING_UNAVAILABLE" : data.orderingPaused ? "ORDERING_PAUSED" : "");
    } catch (error) { setError(error instanceof RequestError ? error.code : "NETWORK"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = setTimeout(() => { void load(); }, 0); return () => clearTimeout(initial); }, [load]);
  function updateCart(next: CartLine[]) {
    try { saveCart(next); setCart(next); setError(""); } catch { setError("STORAGE"); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    let input = pending;
    if (!input) {
      input = { id: crypto.randomUUID(), accessKey: newAccessKey(), customerName: name, phone, kind: "court", locationId: location, locationConfirmed: confirmed,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, priceIdr: item.priceIdr })) };
      try { savePending(draftKey, input, false); setPending(input); }
      catch { setError("STORAGE"); setBusy(false); submitting.current = false; return; }
    }
    try {
      const order = await postJson<OrderView>("/api/orders/create", input);
      try { rememberOrder(order.id, input.accessKey, order.accessExpiresAt); clearPending(draftKey, false); saveCart([]); }
      catch { /* The private recovery URL still preserves access after a committed checkout. */ }
      setPending(null); setCart([]); window.location.assign(recoveryPath(order.id, input.accessKey));
    } catch (error) {
      const code = error instanceof RequestError ? error.code : "NETWORK"; setError(code);
      if (["PRICE_CHANGED", "ITEM_UNAVAILABLE", "LOCATION_UNAVAILABLE", "INVALID_INPUT", "INVALID_ITEMS", "INVALID_ID", "PHONE_REQUIRED", "LOCATION_CONFIRMATION_REQUIRED", "ORDER_TOO_LARGE", "COURT_ONLY"].includes(code)) {
        try { clearPending(draftKey, false); setPending(null); } catch { /* Preserve the exact retry draft on storage failure. */ }
      }
    } finally { setBusy(false); submitting.current = false; }
  }
  async function reviewPrices() {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const next: PublicCatalog = await response.json(); setCatalog(next); setConfirmed(false);
      updateCart(cart.flatMap(item => {
        const fresh = next.products.find(product => product.id === item.productId && product.available && product.priceIdr > 0);
        return fresh ? [{ ...item, name: fresh.name, nameEn: fresh.nameEn, priceIdr: fresh.priceIdr }] : [];
      }));
    } catch { setError("NETWORK"); }
  }
  const lines: CartLine[] = pending ? pending.items.map(item => ({ ...item, name: catalog?.products.find(value => value.id === item.productId)?.name ?? item.productId,
    nameEn: catalog?.products.find(value => value.id === item.productId)?.nameEn ?? null })) : cart;
  const locations = catalog?.locations.filter(item => item.kind === "court") ?? [];
  const canEdit = !busy && !pending;
  return <OrderShell language={language} change={change}>
    <h1 className="order-title">{t.checkout}</h1><p className="order-lead">{t.checkoutIntro}</p>
    {error && <p className="menu-alert" role="alert">{errorText(error, t)}</p>}
    {catalog?.orderingPaused && error !== "ORDERING_PAUSED" && <p className="menu-alert" role="status">{t.paused}</p>}
    {catalog?.orderingPaused && <button type="button" className="menu-refresh" onClick={() => { void load(); }}>{language === "id" ? "Periksa pemesanan" : "Check ordering availability"}</button>}
    {loading ? <p role="status" className="menu-status">{t.loading}</p> : <form onSubmit={submit}>
      <fieldset disabled={!canEdit} className="checkout-layout">
        <section className="order-panel checkout-cart" aria-label={t.cart}><h2>{t.cart}</h2>
          {!lines.length ? <p>{t.empty}</p> : lines.map(item => <div className="order-line" key={item.productId}><div><strong>{language === "en" ? item.nameEn || item.name : item.name}</strong><p>{formatIdr(item.priceIdr)}</p>
            <div className="order-quantity"><button type="button" aria-label={`${language === "id" ? "Kurangi" : "Decrease"} ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateCart(cart.map(value => value.productId === item.productId ? { ...value, quantity: value.quantity - 1 } : value))}>−</button><span>{item.quantity}</span>
              <button type="button" aria-label={`${language === "id" ? "Tambah jumlah" : "Increase"} ${item.name}`} disabled={item.quantity >= 99} onClick={() => updateCart(cart.map(value => value.productId === item.productId ? { ...value, quantity: value.quantity + 1 } : value))}>+</button></div>
            <button type="button" className="order-remove" aria-label={`${t.remove} ${item.name}`} onClick={() => updateCart(cart.filter(value => value.productId !== item.productId))}>{t.remove}</button></div>
            <strong>{formatIdr(BigInt(item.priceIdr) * BigInt(item.quantity))}</strong></div>)}
          <div className="order-total"><strong>{t.total}</strong><strong>{formatIdr(lines.reduce((sum, item) => sum + BigInt(item.priceIdr) * BigInt(item.quantity), 0n))}</strong></div><p className="order-hint">{t.inclusive}</p>
        </section>
        {lines.length > 0 && <section className="order-panel order-form checkout-contact"><h2>{t.deliverTo}</h2>
          <label>{t.location}<select aria-label={t.location} value={location} required onChange={event => { setLocation(event.target.value); setConfirmed(false); }}><option value="">{t.choose}</option>
            {locations.map(item => <option key={item.id} value={item.id}>{item.buildingName} / {item.name}</option>)}</select></label>
          {!locations.length && <p className="order-hint">{t.noCourts}</p>}
          <label>{t.name}<input value={name} required maxLength={120} autoComplete="name" onChange={event => setName(event.target.value)} /></label>
          <label>{t.phone}<input type="tel" required maxLength={30} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label>
          <p className="order-hint">{t.contactReason}</p>
          <label className="order-checkbox"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t.confirm}</label>
          <div className="order-pay-note"><strong>{t.payAtDelivery}</strong><p>{t.payAtDeliveryNote}</p></div>
        </section>}
      </fieldset>
      {pending && <p className="menu-alert" role="status">{t.pending}</p>}
      {lines.length > 0 && <button className="menu-button menu-button-primary order-submit" disabled={busy || !catalog?.orderingEnabled || (!pending && (!locations.length || catalog.orderingPaused))}>{busy ? t.submitting : pending ? t.retry : t.place}</button>}
      {!pending && (error === "PRICE_CHANGED" || error === "ITEM_UNAVAILABLE" || error === "LOCATION_UNAVAILABLE") && <button type="button" className="menu-refresh" onClick={() => { void reviewPrices(); }}>{t.refresh}</button>}
      <p className="order-hint order-checkout-foot">{t.noEdit}</p>
    </form>}
  </OrderShell>;
}
