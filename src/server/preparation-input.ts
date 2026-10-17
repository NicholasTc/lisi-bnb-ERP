import { checkKeys, idField, integerField, textField } from "./catalog-input";
import { HttpError } from "./http";
import { preparationStates, type PreparationCommand, type PreparationState } from "../preparation/types";
export function preparationState(value: unknown): PreparationState {
  if (!preparationStates.includes(value as PreparationState)) throw new HttpError(400, "INVALID_INPUT");
  return value as PreparationState;
}
export function preparationInput(raw: Record<string, unknown>): PreparationCommand {
  const kind = raw.kind;
  if (kind !== "claim" && kind !== "ready" && kind !== "hold" && kind !== "pause" && kind !== "resume") throw new HttpError(400, "INVALID_INPUT");
  const service = kind === "pause" || kind === "resume", reason = kind === "hold" || kind === "pause";
  checkKeys(raw, ["id", "kind", service ? "version" : "orderId", ...(reason ? ["reason"] : [])]);
  return { id: idField(raw.id), kind, ...(service ? { version: integerField(raw, "version", 1) } : { orderId: idField(raw.orderId) }),
    ...(reason ? { reason: textField(raw, "reason", 200) } : {}) };
}
