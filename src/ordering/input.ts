import { HttpError } from "../server/http";
import { checkKeys, idField, integerField, textField } from "../server/catalog-input";
import type { CheckoutInput, DemoPayload } from "./types";
export function accessKey(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new HttpError(404, "ORDER_NOT_FOUND");
  return value;
}
export function checkoutInput(input: Record<string, unknown>): CheckoutInput {
  checkKeys(input, ["id", "accessKey", "customerName", "phone", "kind", "locationId", "locationConfirmed", "items"]);
  const kind = input.kind;
  if (kind !== "court" && kind !== "pickup" && kind !== "dine_in") throw new HttpError(400, "INVALID_INPUT");
  let phone = textField(input, "phone", 30, true) || null;
  if (kind === "court" && (!phone || !/^\+?[0-9 ()-]{8,30}$/.test(phone) || phone.replace(/\D/g, "").length < 8)) throw new HttpError(400, "PHONE_REQUIRED");
  if (kind !== "court") phone = null;
  if (kind === "court" && input.locationConfirmed !== true) throw new HttpError(400, "LOCATION_CONFIRMATION_REQUIRED");
  const locationId = kind === "pickup" ? null : idField(input.locationId);
  if (kind === "pickup" && input.locationId != null) throw new HttpError(400, "INVALID_INPUT");
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw new HttpError(400, "INVALID_ITEMS");
  const items = input.items.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "INVALID_ITEMS");
    checkKeys(raw, ["productId", "quantity", "priceIdr"]);
    const quantity = integerField(raw, "quantity", 1);
    if (quantity > 99) throw new HttpError(400, "INVALID_ITEMS");
    return { productId: idField(raw.productId), quantity, priceIdr: integerField(raw, "priceIdr", 1) };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  if (new Set(items.map(item => item.productId)).size !== items.length) throw new HttpError(400, "INVALID_ITEMS");
  exactTotal(items.map(item => ({ quantity: item.quantity, unitPriceIdr: item.priceIdr })));
  return { id: idField(input.id), accessKey: accessKey(input.accessKey), customerName: textField(input, "customerName", 120), phone, kind, locationId, locationConfirmed: kind === "court", items };
}
export function exactTotal(items: { quantity: number; unitPriceIdr: number }[]) {
  const value = items.reduce((total, item) => total + BigInt(item.quantity) * BigInt(item.unitPriceIdr), 0n);
  if (value <= 0n || value > 2_147_483_647n) throw new HttpError(400, "ORDER_TOO_LARGE");
  return Number(value);
}
export function paymentEventInput(input: Record<string, unknown>): DemoPayload {
  checkKeys(input, ["eventId", "orderId", "transactionId", "flow", "status", "amountIdr", "currency"]);
  if ((input.flow !== "payment" && input.flow !== "refund") ||
      !["pending", "succeeded", "failed", "expired"].includes(String(input.status)) ||
      (input.flow === "refund" && input.status === "expired")) throw new HttpError(400, "INVALID_INPUT");
  const currency = textField(input, "currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, "INVALID_INPUT");
  return { eventId: idField(input.eventId), orderId: idField(input.orderId), transactionId: idField(input.transactionId),
    flow: input.flow, status: input.status as DemoPayload["status"], amountIdr: integerField(input, "amountIdr", 0), currency };
}
export const demoInput = paymentEventInput;
