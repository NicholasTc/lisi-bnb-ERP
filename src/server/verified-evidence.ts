import "server-only";
import { HttpError } from "./http";
import type { PaymentEvent } from "../ordering/types";
import { paymentEventInput } from "../ordering/input";
const verified = Symbol("provider-verified-evidence");
export type VerifiedEvidence = Readonly<{ [verified]: true; provider: string; simulated: boolean; payload: Readonly<PaymentEvent> }>;
/** Only a server adapter that has verified its source may construct this value. */
export function verifiedByProvider(provider: string, simulated: boolean, payload: PaymentEvent): VerifiedEvidence {
  return Object.freeze({ [verified]: true as const, provider, simulated, payload: Object.freeze(paymentEventInput(payload)) });
}
export function assertVerifiedEvidence(value: VerifiedEvidence) {
  if (!value || value[verified] !== true) throw new HttpError(403, "UNTRUSTED_PAYMENT_EVIDENCE");
}
