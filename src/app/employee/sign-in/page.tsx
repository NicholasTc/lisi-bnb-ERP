"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clearCounterDrafts } from "@/ordering/browser";

type Identity = { user: { name: string; email: string }; roles: string[] };
export default function SignIn() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lastActivity = useRef(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const started = generation.current;
    try {
      const response = await fetch("/api/employee/me", { cache: "no-store" });
      if (started !== generation.current) return;
      if (response.ok) setIdentity(await response.json());
      else if (response.status === 401) setIdentity(null);
      else { setIdentity(null); setMessage("Employee access is unavailable. Try again shortly."); }
    } catch { setIdentity(null); setMessage("Connection unavailable. Check your connection and try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    // Passive checks clear stale access but never count as employee activity.
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!identity) return;
    const activity = () => {
      if (Date.now() - lastActivity.current < 10_000) return;
      lastActivity.current = Date.now();
      void fetch("/api/employee/activity", { method: "POST" }).then(response => {
        if (response.status === 401) { setIdentity(null); setMessage("Your session ended. Sign in again."); }
      }).catch(() => { setIdentity(null); setMessage("Connection unavailable. Sign in again when it returns."); });
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => { window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); };
  }, [identity]);
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }) });
      if (response.ok) { generation.current++; form.reset(); await refresh(); }
      else setMessage(response.status === 429 ? "Too many attempts. Wait a minute before trying again." :
        response.status >= 500 ? "Employee access is unavailable. Try again shortly." : "Email or password is incorrect, or this account is disabled.");
    } catch { setMessage("Connection unavailable. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.ok) { generation.current++; setIdentity(null); try { clearCounterDrafts(); } catch { /* Server session is already revoked. */ } }
      else setMessage("Sign-out could not be confirmed. Retry before leaving this device.");
    } catch { setMessage("Sign-out could not be confirmed. Reconnect and retry before leaving this device."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-6 py-12">
    <Link href="/" className="text-sm underline">LISI BNB ERP</Link>
    <h1 className="mt-8 text-2xl font-bold">Employee sign in</h1>
    <p className="mt-3 text-sm">Use your individual account. Sign out before leaving a shared device.</p>
    {loading ? <p role="status" className="mt-6">Checking access…</p> : identity ?
      <section className="mt-8 border-t border-slate-300 pt-6" aria-label="Current employee">
        <p>Signed in as <strong>{identity.user.name}</strong></p>
        <p className="mt-2 text-sm">{identity.user.email}</p>
        {identity.roles.some(role => role === "owner" || role === "preparation") && <Link className="mt-5 block underline" href="/employee/menu">Manage menu & locations</Link>}
        <button className="mt-6 min-h-12 rounded-md bg-[#17304b] px-6 text-white" disabled={busy} onClick={() => { void signOut(); }}>Sign out</button>
      </section> :
      <form onSubmit={signIn} className="mt-8 space-y-5">
        <label className="block">Email<input name="email" type="email" autoComplete="username" required className="mt-2 block min-h-12 w-full rounded-md border border-slate-400 bg-white px-3" /></label>
        <label className="block">Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} className="mt-2 block min-h-12 w-full rounded-md border border-slate-400 bg-white px-3" /></label>
        <button disabled={busy} className="min-h-12 w-full rounded-md bg-[#17304b] px-6 text-white">{busy ? "Signing in…" : "Sign in"}</button>
      </form>}
    {message && <p role="alert" className="mt-5 text-sm text-red-800">{message}</p>}
  </main>;
}
