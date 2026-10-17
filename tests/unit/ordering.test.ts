import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutInput, exactTotal } from "../../src/ordering/input";
import { formatIdr } from "../../src/catalog/types";
import { assertVerifiedEvidence, verifiedByProvider } from "../../src/server/verified-evidence";
const input = () => ({ id: randomUUID(), accessKey: randomBytes(32).toString("hex"), customerName: "Guest", kind: "pickup", locationId: null, phone: null,
  items: [{ productId: randomUUID(), quantity: 2, priceIdr: 25000 }] });
describe("exact checkout inputs", () => {
  it("calculates independent integer totals and formats large aggregates without floating point", () => {
    expect(exactTotal([{ quantity: 3, unitPriceIdr: 17000 }, { quantity: 2, unitPriceIdr: 23000 }])).toBe(97000);
    expect(formatIdr("9007199254740993")).toBe("Rp 9.007.199.254.740.993");
  });
  it("rejects overflow, empty, duplicate, free, fractional and forged fields", () => {
    expect(() => exactTotal([{ quantity: 99, unitPriceIdr: 2147483647 }])).toThrow("ORDER_TOO_LARGE");
    const value = input();
    for (const change of [{ items: [] }, { items: [value.items[0], value.items[0]] }, { totalIdr: 1 }, { source: "counter" }, { items: [{ ...value.items[0], priceIdr: 0 }] }, { items: [{ ...value.items[0], quantity: 1.5 }] }]) {
      expect(() => checkoutInput({ ...value, ...change })).toThrow();
    }
  });
  it("requires a validated destination and phone for court delivery, not for pickup", () => {
    const value = input(); expect(checkoutInput(value).phone).toBeNull();
    expect(() => checkoutInput({ ...value, kind: "court", locationId: randomUUID() })).toThrow("PHONE_REQUIRED");
    expect(() => checkoutInput({ ...value, kind: "court", locationId: randomUUID(), phone: "+62 812 3456 7890" })).toThrow("LOCATION_CONFIRMATION_REQUIRED");
    expect(checkoutInput({ ...value, kind: "court", locationId: randomUUID(), phone: "+62 812 3456 7890", locationConfirmed: true }).kind).toBe("court");
  });
  it("cannot reconstruct verified provider evidence from client JSON", () => {
    const evidence = verifiedByProvider("demo", true, { eventId: randomUUID(), orderId: randomUUID(), transactionId: randomUUID(), flow: "payment", status: "succeeded", amountIdr: 25000, currency: "IDR" });
    expect(() => assertVerifiedEvidence(evidence)).not.toThrow();
    expect(() => assertVerifiedEvidence(JSON.parse(JSON.stringify(evidence)))).toThrow("UNTRUSTED_PAYMENT_EVIDENCE");
  });
});
