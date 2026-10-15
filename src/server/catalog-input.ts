import "server-only";
import { HttpError } from "./http";
import type { CatalogEntity } from "../catalog/types";

export function textField(input: Record<string, unknown>, field: string, max: number, optional = false) {
  const value = input[field];
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string" || value.trim().length > max || (!optional && !value.trim())) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value.trim();
}
export function integerField(input: Record<string, unknown>, field: string, minimum: number) {
  const value = input[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > 2_147_483_647) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}
export function booleanField(input: Record<string, unknown>, field: string) {
  if (typeof input[field] !== "boolean") throw new HttpError(400, "INVALID_INPUT");
  return input[field];
}
export function idField(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_ID");
  }
  return value;
}
export function checkKeys(input: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new HttpError(400, "INVALID_INPUT");
}
export function entityField(value: unknown): CatalogEntity {
  if (value !== "product" && value !== "building" && value !== "location") throw new HttpError(404, "NOT_FOUND");
  return value;
}
export function productInput(input: Record<string, unknown>) {
  return {
    name: textField(input, "name", 120), nameEn: textField(input, "nameEn", 120, true) || null,
    description: textField(input, "description", 500, true), descriptionEn: textField(input, "descriptionEn", 500, true) || null,
    category: textField(input, "category", 60), categoryEn: textField(input, "categoryEn", 60, true) || null,
    priceIdr: integerField(input, "priceIdr", 0), available: booleanField(input, "available"), active: booleanField(input, "active"),
  };
}
export function locationInput(input: Record<string, unknown>) {
  const kind = input.kind;
  if (kind !== "court" && kind !== "table") throw new HttpError(400, "INVALID_INPUT");
  const tableNumber = kind === "table" ? integerField(input, "tableNumber", 1) : null;
  if (kind === "court" && input.tableNumber != null) throw new HttpError(400, "INVALID_INPUT");
  return { buildingId: idField(input.buildingId), kind, tableNumber,
    name: kind === "table" ? String(tableNumber) : textField(input, "name", 120), active: booleanField(input, "active") };
}
