"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CourtArt } from "./court-art";
import { copy } from "../catalog/copy";
import { formatIdr, type Language, type PublicCatalog } from "../catalog/types";

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
      if (initial.current) { setSelected(data.qr.courtId ?? ""); initial.current = false; }
      if (data.qr.status === "invalid") { setConfirmed(false); setEditing(true); }
    } catch { if (version === generation.current) { setFailed(true); setConfirmed(false); } }
    finally { if (version === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try { if (localStorage.getItem("lisi-language") === "en") setLanguage("en"); } catch { /* Preference storage is optional. */ }
      void refresh();
    }, 0);
    const polling = setInterval(() => { void refresh(); }, 60_000);
    return () => { clearTimeout(timer); clearInterval(polling); invalidate(); };
  }, [refresh, invalidate]);
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
          <Link href="/employee/sign-in" className="menu-staff-link">{t.staff}</Link>
        </div>
      </header>
      <section className="menu-hero">
        <div><h1>{t.title}</h1><p>{t.intro}</p></div>
        <CourtArt />
      </section>
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
      <section aria-label={t.menu}>
        <div className="menu-heading-row"><h2>{t.menu}</h2><button className="menu-refresh" disabled={loading || busy} onClick={() => { void refresh(); }}>{t.refresh}</button></div>
        {failed && <p className="menu-alert mb-5" role="alert">{t.offline}</p>}
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
            </div><strong className="menu-price">{formatIdr(item.priceIdr)}</strong>
          </article>)}</div>
          {!visible.length && <p role="status" className="menu-status">{t.noMatches}</p>}
        </> : !failed && <p className="menu-status" role="status">{t.empty}</p>}
      </section>
      <footer className="menu-footer"><p>{t.prices}</p><p>{t.preview}</p></footer>
    </div>
  </main>;
}
