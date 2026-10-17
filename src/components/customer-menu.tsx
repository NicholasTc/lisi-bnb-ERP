"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CourtArt } from "./court-art";
import { orderCopy } from "../ordering/copy";
import { copy } from "../catalog/copy";
import { formatIdr, type Language, type PublicCatalog } from "../catalog/types";
import { readCart, saveCart, rememberedOrders, recoveryPath, type CartLine } from "../ordering/browser";

export function CustomerMenu() {
  const [language, setLanguage] = useState<Language>("id");
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [recent, setRecent] = useState<ReturnType<typeof rememberedOrders>>([]);
  const initial = useRef(true);
  const generation = useRef(0);
  const confirming = useRef(false);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const t = copy[language];
  const refresh = useCallback(async () => {
    if (confirming.current) return;
    const version = ++generation.current;
    try {
      const court = new URL(window.location.href).searchParams.get("court");
      const response = await fetch(`/api/catalog${court === null ? "" : `?court=${encodeURIComponent(court)}`}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const data: PublicCatalog = await response.json();
      if (version !== generation.current) return;
      setCatalog(data); setFailed(false);
      if (initial.current) { setSelected(data.qr.courtId ?? ""); setEditing(data.qr.status !== "valid"); initial.current = false; }
      if (data.qr.status === "invalid") { setConfirmed(false); setEditing(true); }
    } catch { if (version === generation.current) { setFailed(true); setConfirmed(false); } }
    finally { if (version === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setCart(readCart()); setRecent(rememberedOrders());
      try { if (localStorage.getItem("lisi-language") === "en") setLanguage("en"); } catch { /* Preference storage is optional. */ }
      void refresh();
    }, 0);
    const polling = setInterval(() => { void refresh(); }, 60_000);
    return () => { clearTimeout(timer); clearInterval(polling); invalidate(); };
  }, [refresh, invalidate]);
  function addItem(item: PublicCatalog["products"][number]) {
    const next = [...cart];
    const index = next.findIndex(line => line.productId === item.id);
    if (index >= 0) next[index] = { ...next[index], priceIdr: item.priceIdr, quantity: Math.min(99, next[index].quantity + 1) };
    else if (next.length < 50) next.push({ productId: item.id, name: item.name, nameEn: item.nameEn, priceIdr: item.priceIdr, quantity: 1 });
    try { saveCart(next); setCart(next); setStorageError(false); } catch { setStorageError(true); }
  }
  function changeLanguage(value: Language) {
    setLanguage(value);
    try { localStorage.setItem("lisi-language", value); } catch { /* Browsing works without storage. */ }
  }
  async function confirmCourt(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); confirming.current = true; setLocationError(false);
    const version = ++generation.current;
    try {
      const response = await fetch(`/api/catalog?court=${encodeURIComponent(selected)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const data: PublicCatalog = await response.json();
      if (version !== generation.current) return;
      setCatalog(data);
      if (data.qr.status !== "valid") { setConfirmed(false); setLocationError(true); return; }
      const url = new URL(window.location.href); url.searchParams.set("court", selected);
      window.history.replaceState(null, "", url);
      setFailed(false); setConfirmed(true); setEditing(false);
    } catch { setConfirmed(false); setLocationError(true); }
    finally { confirming.current = false; setBusy(false); }
  }
  const courts = catalog?.locations.filter(place => place.kind === "court") ?? [];
  const place = courts.find(place => place.id === selected);
  const products = catalog?.products ?? [];
  const categories = [...new Set(products.map(item => item.category))];
  const visible = products.filter(item => (!category || category === item.category) &&
    [item.name, item.nameEn, item.description, item.descriptionEn].some(value => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())));
  return <main className="customer-menu" lang={language}>
    <div className="menu-shell">
      <header className="menu-header">
        <Link href="/" className="menu-brand" aria-label="LISI BNB">LISI<span> BNB</span></Link>
        <div className="menu-header-actions">
          <div className="menu-language" role="group" aria-label={language === "id" ? "Bahasa" : "Language"}>
            <button aria-pressed={language === "id"} onClick={() => changeLanguage("id")}>ID</button>
            <button aria-pressed={language === "en"} onClick={() => changeLanguage("en")}>EN</button>
          </div>

        </div>
      </header>
      <section className="menu-location" aria-label={t.location}>
        <div className="menu-location-summary">
          <div><p className="menu-location-label">{t.location}</p><strong>{place ? `${place.buildingName} / ${place.name}` : t.noLocation}</strong>
            {confirmed && <p className="menu-confirmed" role="status">✓ {t.confirmed}</p>}</div>
          {!editing && <button className="menu-button" onClick={() => { setEditing(true); setConfirmed(false); }}>{t.change}</button>}
        </div>
        {catalog?.qr.status === "invalid" && <p role="alert" className="menu-alert">{t.invalid}</p>}
        {!loading && !courts.length && <p className="menu-location-label mt-3">{t.noCourts}</p>}
        {editing && courts.length > 0 && <form onSubmit={confirmCourt} className="menu-location-form">
          <label>{t.choose}<select value={selected} required onChange={event => { setSelected(event.target.value); setConfirmed(false); }}>
            <option value="">{t.choose}</option>
            {courts.map(place => <option key={place.id} value={place.id}>{place.buildingName} / {place.name}</option>)}
          </select></label>
          <button className="menu-button menu-button-primary" disabled={busy || !selected}>{t.confirm}</button>
        </form>}
        {locationError && <p className="menu-alert" role="alert">{t.locationError}</p>}
      </section>
      <section className="menu-hero">
        <div><h1>{t.title}</h1><p>{t.intro}</p></div>
        <CourtArt />
      </section>
      <section aria-label={t.menu}>
        <div className="menu-heading-row"><h2>{t.menu}</h2><button className="menu-refresh" disabled={loading || busy} onClick={() => { void refresh(); }}>{t.refresh}</button></div>
        {failed && <p className="menu-alert mb-5" role="alert">{t.offline}</p>}
        {catalog?.orderingPaused && <p className="menu-alert" role="status">{orderCopy[language].paused}</p>}
        {loading ? <p className="menu-status" role="status">{t.loading}</p> : products.length ? <>
          <label className="menu-search"><span className="sr-only">{t.search}</span><input type="search" value={search} placeholder={t.searchPlaceholder} onChange={event => setSearch(event.target.value)} maxLength={120} /></label>
          <div className="menu-filters" role="group" aria-label={language === "id" ? "Kategori menu" : "Menu categories"}>
            <button className="menu-filter" aria-pressed={!category} onClick={() => setCategory("")}>{t.all}</button>
            {categories.map(value => <button key={value} className="menu-filter" aria-pressed={category === value} onClick={() => setCategory(value)}>
              {language === "en" ? products.find(item => item.category === value)?.categoryEn || value : value}
            </button>)}
          </div>
          <div className="menu-items">{visible.map(item => <article key={item.id} className="menu-item">
            <div><h3>{language === "en" ? item.nameEn || item.name : item.name}</h3>
              {(item.description || item.descriptionEn) && <p>{language === "en" ? item.descriptionEn || item.description : item.description}</p>}
              {!item.available && <span className="menu-unavailable">{t.unavailable}</span>}
              <strong className="menu-price">{formatIdr(item.priceIdr)}</strong>
            </div><div className="menu-item-order"><svg className="menu-drink-art" viewBox="0 0 110 100" fill="none" aria-hidden="true"><path d="M34 25h42l-5 60H39Z" fill="white" stroke="currentColor" strokeWidth="2.5"/><path d="M38 46h34l-3 35H41Z" fill="currentColor" opacity=".16"/><path d="m59 27 7-18h14M30 25h50" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="m46 38 8 2-2 8-8-2Zm13 12 8-2 2 8-8 2Z" stroke="currentColor" strokeWidth="1.5"/></svg>
              {catalog?.orderingEnabled && item.available && item.priceIdr > 0 && <button className="menu-add" aria-label={`${language === "id" ? "Tambah" : "Add"} ${language === "en" ? item.nameEn || item.name : item.name}`} disabled={cart.some(line => line.productId === item.id && line.quantity >= 99)} onClick={() => addItem(item)}>+ <span>{language === "id" ? "Tambah" : "Add"}</span></button>}
            </div>
          </article>)}</div>
          {!visible.length && <p role="status" className="menu-status">{t.noMatches}</p>}
        </> : !failed && <p className="menu-status" role="status">{t.empty}</p>}
      </section>
      {storageError && <p className="menu-alert" role="alert">{language === "id" ? "Penyimpanan browser diperlukan untuk menyimpan keranjang. Aktifkan lalu coba lagi." : "Browser storage is needed to keep your cart. Enable it and try again."}</p>}
      {recent.length > 0 && <details className="menu-order-history"><summary>{language === "id" ? "Pesanan saya" : "My orders"}</summary><nav className="menu-recent" aria-label={language === "id" ? "Pesanan saya" : "My orders"}>
        <h2>{language === "id" ? "Pesanan saya" : "My orders"}</h2>
        {recent.map((value, index) => <Link key={value.id} href={recoveryPath(value.id, value.accessKey)} prefetch={false}>{language === "id" ? "Buka pesanan" : "Open order"} {index + 1}</Link>)}
      </nav></details>}
      <footer className="menu-footer"><p>{t.prices}</p><p>{catalog?.orderingEnabled ? t.test : t.preview}</p><Link href="/employee/sign-in" className="menu-staff-link">{t.staff}</Link></footer>
      {catalog?.orderingEnabled && cart.length > 0 && <Link className="menu-cart-bar" href={`/checkout${selected ? `?court=${selected}` : ""}`}>
        <span>{language === "id" ? "Lihat keranjang" : "View cart"} ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
        <strong>{formatIdr(cart.reduce((sum, item) => sum + BigInt(item.priceIdr) * BigInt(item.quantity), 0n))}</strong>
      </Link>}
      <p className="sr-only" role="status">{cart.reduce((sum, item) => sum + item.quantity, 0)} {language === "id" ? "item di keranjang" : "items in cart"}</p>
    </div>
  </main>;
}
