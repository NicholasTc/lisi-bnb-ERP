import type { CheckoutInput } from "./types";
export type CartLine = { productId: string; name: string; nameEn: string | null; priceIdr: number; quantity: number };
const day = 24 * 60 * 60 * 1000;
export function cartKey(counter = false) { return counter ? "lisi-counter-cart" : "lisi-cart"; }
export function readCart(counter = false): CartLine[] {
  try {
    const stored = JSON.parse(localStorage.getItem(cartKey(counter)) ?? "null");
    if (!stored || Date.now() - stored.updatedAt > day || !Array.isArray(stored.items)) return [];
    return stored.items.filter((item: CartLine) => typeof item.productId === "string" && typeof item.name === "string" &&
      Number.isInteger(item.priceIdr) && item.priceIdr > 0 && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99).slice(0, 50);
  } catch { return []; }
}
export function saveCart(items: CartLine[], counter = false) {
  localStorage.setItem(cartKey(counter), JSON.stringify({ updatedAt: Date.now(), items }));
}
export function pendingKey(counter: boolean, employeeId: string) { return counter ? `lisi-pending-counter:${employeeId}` : "lisi-pending-guest"; }
export function readPending(key: string, counter = false): CheckoutInput | null {
  try {
    const storage = counter ? sessionStorage : localStorage;
    const saved = JSON.parse(storage.getItem(key) ?? "null");
    if (saved && Date.now() - saved.createdAt < day) return saved.input;
    storage.removeItem(key);
  } catch { /* No submitted draft exists. */ }
  return null;
}
export function savePending(key: string, input: CheckoutInput, counter: boolean) {
  (counter ? sessionStorage : localStorage).setItem(key, JSON.stringify({ createdAt: Date.now(), input }));
}
export function clearPending(key: string, counter: boolean) { (counter ? sessionStorage : localStorage).removeItem(key); }
export function clearCounterDrafts() {
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key?.startsWith("lisi-pending-counter:") || key?.startsWith("lisi-demo-command:") || key?.startsWith("lisi-preparation-command:") || key?.startsWith("lisi-operation-command:")) sessionStorage.removeItem(key);
  }
  localStorage.removeItem(cartKey(true));
}
export function newAccessKey() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join(""); }
export function recoveryPath(id: string, accessKey: string) { return `/orders/${id}#${accessKey}`; }
export function rememberOrder(id: string, accessKey: string, expiresAt: string) {
  const records = rememberedOrders().filter(value => value.id !== id);
  localStorage.setItem("lisi-order-links", JSON.stringify([{ id, accessKey, expiresAt }, ...records].slice(0, 20)));
}
export function rememberedOrders(): { id: string; accessKey: string; expiresAt: string }[] {
  try {
    const saved = JSON.parse(localStorage.getItem("lisi-order-links") ?? "[]");
    const active = saved.filter((value: { expiresAt: string }) => Date.parse(value.expiresAt) > Date.now());
    if (active.length !== saved.length) localStorage.setItem("lisi-order-links", JSON.stringify(active));
    return active;
  }
  catch { return []; }
}
