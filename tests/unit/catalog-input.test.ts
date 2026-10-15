import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkKeys, locationInput, productInput } from "../../src/server/catalog-input";
import { formatIdr } from "../../src/catalog/types";
const base = { name: " Kopi ", category: "Minuman", priceIdr: 25000, available: true, active: true };
describe("catalog validation", () => {
  it("normalizes optional translations and preserves exact integer prices", () => {
    expect(productInput({ ...base, nameEn: " Coffee " })).toMatchObject({ name: "Kopi", nameEn: "Coffee", priceIdr: 25000, description: "", categoryEn: null });
    expect(formatIdr(25000)).toBe("Rp 25.000");
  });
  it("rejects fractional, coerced, negative, non-finite and overflowing prices", () => {
    for (const priceIdr of [1.5, "25000", -1, NaN, Infinity, 2147483648]) {
      expect(() => productInput({ ...base, priceIdr })).toThrow("INVALID_INPUT");
    }
  });
  it("rejects empty names/categories, oversized descriptions and non-booleans", () => {
    for (const changes of [{ name: " " }, { category: "" }, { description: "a".repeat(501) }, { available: "true" }, { nameEn: 1 }]) {
      expect(() => productInput({ ...base, ...changes })).toThrow("INVALID_INPUT");
    }
  });
  it("requires numbered tables and a valid parent identity", () => {
    const buildingId = randomUUID();
    expect(locationInput({ buildingId, kind: "table", tableNumber: 4, active: true })).toMatchObject({ name: "4", tableNumber: 4 });
    for (const changes of [{ tableNumber: null }, { tableNumber: 0 }, { tableNumber: 1.5 }, { buildingId: "unknown" }, { kind: "other" }]) {
      expect(() => locationInput({ buildingId, kind: "table", tableNumber: 4, active: true, ...changes })).toThrow();
    }
  });
  it("rejects fields outside the approved operation", () => {
    expect(() => checkKeys({ available: true, priceIdr: 1 }, ["available"])).toThrow("INVALID_INPUT");
  });
});
