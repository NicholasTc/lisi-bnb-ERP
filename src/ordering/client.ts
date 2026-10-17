"use client";
import { useCallback, useEffect, useState } from "react";
import type { Language } from "../catalog/types";
export class RequestError extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}
export async function postJson<T>(url: string, body: object): Promise<T> {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: controller.signal });
    const value = await response.json();
    if (!response.ok) throw new RequestError(value.error?.code ?? "UNAVAILABLE", response.status);
    return value;
  } finally { clearTimeout(timeout); }
}
export function useLanguage() {
  const [language, setLanguage] = useState<Language>("id");
  useEffect(() => {
    const timer = setTimeout(() => { try { if (localStorage.getItem("lisi-language") === "en") setLanguage("en"); } catch { /* Optional preference. */ } }, 0);
    return () => clearTimeout(timer);
  }, []);
  const change = useCallback((value: Language) => {
    setLanguage(value); try { localStorage.setItem("lisi-language", value); } catch { /* Optional preference. */ }
  }, []);
  return [language, change] as const;
}
