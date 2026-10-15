"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatIdr, type Building, type CatalogEntity, type Location, type Product, type StaffCatalog } from "../catalog/types";

type Identity = { user: { name: string }; roles: string[] };
type RecordValue = Product | Building | Location;
type EditorValue = { entity: CatalogEntity; value?: RecordValue };
const errorCopy: Record<string, string> = {
  EDIT_CONFLICT: "Someone changed this record. Discard the draft and refresh before editing again.",
  ALREADY_EXISTS: "This record or location name already exists. Refresh to check whether your earlier save succeeded.",
  INVALID_INPUT: "Check the fields. Prices must be whole rupiah amounts from 0 to 2,147,483,647.",
  INVALID_BUILDING: "This building is no longer available. Refresh the directory.",
  FORBIDDEN: "Your account cannot make this change.",
  UNAUTHENTICATED: "Your session ended. Sign in again.", SESSION_EXPIRED: "Your session ended. Sign in again.",
};
function productPayload(item: Product) {
  return { id: item.id, version: item.version, name: item.name, nameEn: item.nameEn,
    description: item.description, descriptionEn: item.descriptionEn, category: item.category,
    categoryEn: item.categoryEn, priceIdr: item.priceIdr, available: item.available, active: item.active };
}
export function StaffCatalog() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [catalog, setCatalog] = useState<StaffCatalog | null>(null);
  const [editor, setEditor] = useState<EditorValue | null>(null);
  const [tab, setTab] = useState<"menu" | "locations">("menu");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lastActivity = useRef(0);
  const owner = identity?.roles.includes("owner") ?? false;
  const load = useCallback(async () => {
    setMessage("");
    try {
      const me = await fetch("/api/employee/me", { cache: "no-store" });
      if (!me.ok) {
        setIdentity(null); setCatalog(null);
        setMessage(me.status === 401 ? "Sign in to access menu management." : "Employee access is unavailable. Try again shortly.");
        return;
      }
      const who: Identity = await me.json(); setIdentity(who);
      const response = await fetch("/api/employee/catalog", { cache: "no-store" });
      if (!response.ok) {
        setCatalog(null);
        setMessage(response.status === 403 ? "This account does not have menu-management access." : "Menu management is unavailable. Try again shortly.");
        return;
      }
      setCatalog(await response.json());
    } catch { setIdentity(null); setCatalog(null); setMessage("Connection unavailable. Reconnect and sign in again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => {
      void fetch("/api/employee/me", { cache: "no-store" }).then(async response => {
        if (response.ok) { setIdentity(await response.json()); }
        else { setIdentity(null); setCatalog(null); setEditor(null); setMessage("Employee access is unavailable. Sign in again."); }
      }).catch(() => { setIdentity(null); setCatalog(null); setEditor(null); setMessage("Connection unavailable. Reconnect and sign in again."); });
    }, 30_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    if (!identity) return;
    const activity = () => {
      if (Date.now() - lastActivity.current < 10_000) return;
      lastActivity.current = Date.now();
      void fetch("/api/employee/activity", { method: "POST" }).then(response => {
        if (!response.ok) { setIdentity(null); setCatalog(null); setEditor(null); setMessage("Employee access is unavailable. Sign in again."); }
      }).catch(() => { setIdentity(null); setCatalog(null); setEditor(null); setMessage("Connection unavailable. Reconnect and sign in again."); });
    };
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity);
    return () => { window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); };
  }, [identity]);
  async function save(entity: CatalogEntity, body: object, create: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/employee/catalog/${entity}`, { method: create ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        const result = await response.json();
        setMessage(errorCopy[result.error?.code] || "Save could not be confirmed. Refresh to check the current record before retrying.");
        if (response.status === 401 || response.status === 403) { setCatalog(null); setEditor(null); }
        return;
      }
      setEditor(null); await load();
    } catch { setMessage("Save could not be confirmed. Reconnect and refresh to check the current record before retrying."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.ok) window.location.assign("/employee/sign-in");
      else setMessage("Sign-out could not be confirmed. Retry before leaving this device.");
    } catch { setMessage("Sign-out could not be confirmed. Reconnect and retry before leaving this device."); }
    finally { setBusy(false); }
  }
  return <main className="staff-catalog">
    <header className="staff-header"><div><Link href="/">Customer menu</Link><h1>Menu & locations</h1>
      {identity && <p>Signed in as {identity.user.name}</p>}</div>
      {identity ? <button className="staff-button" disabled={busy} onClick={() => { void logout(); }}>Sign out</button> : <Link href="/employee/sign-in">Employee sign in</Link>}
    </header>
    {message && <p role="alert" className="staff-alert">{message}</p>}
    {loading ? <p role="status">Checking access…</p> : catalog && <>
      <div className="staff-toolbar"><div role="group" aria-label="Management section">
        <button className="staff-button" aria-pressed={tab === "menu"} disabled={busy} onClick={() => { setTab("menu"); setEditor(null); }}>Menu</button>
        {owner && <button className="staff-button" aria-pressed={tab === "locations"} disabled={busy} onClick={() => { setTab("locations"); setEditor(null); }}>Locations</button>}
      </div><button className="staff-button" disabled={busy} onClick={() => { setEditor(null); void load(); }}>{editor ? "Discard draft and refresh" : "Refresh records"}</button></div>
      {editor && <CatalogEditor key={`${editor.entity}:${editor.value?.id ?? "new"}`} editor={editor} buildings={catalog.buildings} busy={busy}
        cancel={() => setEditor(null)} save={(body, create) => { void save(editor.entity, body, create); }} />}
      {tab === "menu" ? <section>
        <div className="staff-section-heading"><h2>Menu items</h2>{owner && <button className="staff-button primary" disabled={busy} onClick={() => setEditor({ entity: "product" })}>Add menu item</button>}</div>
        <p className="staff-hint">Prices are final, inclusive IDR amounts. English menu translations are optional. Archived items are hidden from customers.</p>
        {!catalog.products.length && <p className="staff-empty">No menu items yet.{owner ? " Add your first item." : " Ask the owner to add menu items."}</p>}
        {catalog.products.map(item => <article className="staff-record" key={item.id}>
          <div><h3>{item.name}</h3><p>{item.category} · {formatIdr(item.priceIdr)}{!item.active && " · Archived"}</p></div>
          <div className="staff-record-actions"><button className="staff-button" disabled={busy} aria-label={`Set ${item.name} ${item.available ? "unavailable" : "available"}`}
            onClick={() => { void save("product", owner ? { ...productPayload(item), available: !item.available } : { id: item.id, version: item.version, available: !item.available }, false); }}>
            {item.available ? "Available" : "Unavailable"}</button>
            {owner && <button className="staff-button" disabled={busy} aria-label={`Edit ${item.name}`} onClick={() => setEditor({ entity: "product", value: item })}>Edit</button>}
          </div>
        </article>)}
      </section> : owner && <section>
        <div className="staff-section-heading"><h2>Buildings</h2><button className="staff-button primary" disabled={busy} onClick={() => setEditor({ entity: "building" })}>Add building</button></div>
        {!catalog.buildings.length && <p className="staff-empty">Start by adding a building, then its courts or numbered café tables.</p>}
        {catalog.buildings.map(item => <article className="staff-record" key={item.id}><div><h3>{item.name}</h3><p>{item.active ? "Active" : "Inactive — its locations are hidden"}</p></div>
          <button className="staff-button" disabled={busy} aria-label={`Edit building ${item.name}`} onClick={() => setEditor({ entity: "building", value: item })}>Edit</button></article>)}
        <div className="staff-section-heading mt-8"><h2>Courts & tables</h2><button className="staff-button primary" disabled={busy || !catalog.buildings.length} onClick={() => setEditor({ entity: "location" })}>Add location</button></div>
        {catalog.locations.map(item => <article className="staff-record" key={item.id}><div><h3>{item.kind === "table" ? `Table ${item.tableNumber}` : item.name}</h3>
          <p>{catalog.buildings.find(value => value.id === item.buildingId)?.name} · {item.active ? "Active" : "Inactive"}</p>
          {item.kind === "court" && <Link href={`/?court=${item.id}`} target="_blank" rel="noreferrer" className="staff-court-link">Open court QR destination</Link>}</div>
          <button className="staff-button" disabled={busy} aria-label={`Edit location ${item.name}`} onClick={() => setEditor({ entity: "location", value: item })}>Edit</button></article>)}
        <p className="staff-hint mt-5">A location keeps its original building and type. Create a new location if either changes. Inactive locations cannot be confirmed by customers.</p>
      </section>}
    </>}
  </main>;
}

function CatalogEditor({ editor, buildings, busy, cancel, save }: {
  editor: EditorValue; buildings: Building[]; busy: boolean; cancel: () => void; save: (body: object, create: boolean) => void;
}) {
  const [id] = useState(() => editor.value?.id ?? crypto.randomUUID());
  const [kind, setKind] = useState("kind" in (editor.value ?? {}) ? (editor.value as Location).kind : "court");
  const value = editor.value;
  const item = editor.entity === "product" ? value as Product | undefined : undefined;
  const place = editor.entity === "location" ? value as Location | undefined : undefined;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { id, ...(value ? { version: value.version } : {}), active: data.has("active") };
    if (editor.entity === "product") {
      for (const key of ["name", "nameEn", "category", "categoryEn", "description", "descriptionEn"]) body[key] = data.get(key);
      body.priceIdr = Number(data.get("priceIdr")); body.available = data.has("available");
    } else if (editor.entity === "building") body.name = data.get("name");
    else {
      body.kind = kind; body.buildingId = place?.buildingId ?? data.get("buildingId");
      body.name = kind === "court" ? data.get("name") : "";
      body.tableNumber = kind === "table" ? Number(data.get("tableNumber")) : null;
    }
    save(body, !value);
  }
  return <form className="staff-editor" onSubmit={submit} aria-label={`${value ? "Edit" : "Add"} ${editor.entity}`}>
    <h2>{value ? "Edit" : "Add"} {editor.entity === "product" ? "menu item" : editor.entity}</h2>
    <fieldset disabled={busy}><div className="staff-form-grid">
      {editor.entity === "product" ? <>
        <label>Item name<input name="name" required maxLength={120} defaultValue={item?.name} /></label>
        <label>English item name (optional)<input name="nameEn" maxLength={120} defaultValue={item?.nameEn ?? ""} /></label>
        <label>Category<input name="category" required maxLength={60} defaultValue={item?.category} placeholder="e.g. Minuman" /></label>
        <label>English category (optional)<input name="categoryEn" maxLength={60} defaultValue={item?.categoryEn ?? ""} placeholder="e.g. Drinks" /></label>
        <label>Description (optional)<textarea name="description" maxLength={500} defaultValue={item?.description} /></label>
        <label>English description (optional)<textarea name="descriptionEn" maxLength={500} defaultValue={item?.descriptionEn ?? ""} /></label>
        <label>Final price (IDR)<input name="priceIdr" type="number" min={0} max={2147483647} step={1} required defaultValue={item?.priceIdr} /></label>
        <label className="staff-checkbox"><input name="available" type="checkbox" defaultChecked={item?.available ?? true} />Available</label>
      </> : editor.entity === "building" ? <label>Building name<input name="name" required maxLength={120} defaultValue={value?.name} /></label> : <>
        <label>Building<select aria-label="Building" name="buildingId" required disabled={!!place} defaultValue={place?.buildingId ?? ""}><option value="">Choose building</option>
          {buildings.map(item => <option key={item.id} value={item.id}>{item.name}{!item.active && " (inactive)"}</option>)}</select></label>
        <label>Location type<select aria-label="Location type" name="kind" disabled={!!place} value={kind} onChange={event => setKind(event.target.value as "court" | "table")}><option value="court">Court</option><option value="table">Café table</option></select></label>
        {kind === "court" ? <label>Court name<input name="name" required maxLength={120} defaultValue={place?.name} placeholder="e.g. Padel 1" /></label> :
          <label>Table number<input name="tableNumber" type="number" min={1} max={2147483647} step={1} required defaultValue={place?.tableNumber ?? ""} /></label>}
      </>}
      <label className="staff-checkbox"><input name="active" type="checkbox" defaultChecked={value?.active ?? true} />{editor.entity === "product" ? "Visible to customers" : "Active"}</label>
    </div><div className="staff-editor-actions"><button className="staff-button primary">{busy ? "Saving…" : "Save changes"}</button>
      <button type="button" className="staff-button" onClick={cancel}>Cancel</button></div></fieldset>
  </form>;
}
