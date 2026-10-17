import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { demoInput } from "../ordering/input";
import type { DemoPayload } from "../ordering/types";
import { requireDemo } from "./order-db";
import { HttpError } from "./http";
import { verifiedByProvider, type VerifiedEvidence } from "./verified-evidence";

export type DemoEvidence = { payload: DemoPayload; signature: string };
export function signDemoEvidence(raw: Record<string, unknown>): DemoEvidence {
  const config = requireDemo();
  const payload = demoInput(raw);
  const signature = createHmac("sha256", config.demoSecret!).update(JSON.stringify(payload)).digest("hex");
  return { payload, signature };
}
/** Provider-specific verification ends here; shared processing receives normalized evidence. */
export function verifyDemoEvidence(evidence: DemoEvidence): VerifiedEvidence {
  requireDemo();
  const expected = signDemoEvidence(evidence.payload).signature;
  if (typeof evidence.signature !== "string" || !/^[a-f0-9]{64}$/.test(evidence.signature) ||
      !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(evidence.signature, "hex"))) throw new HttpError(403, "UNTRUSTED_PAYMENT_EVIDENCE");
  return verifiedByProvider("demo", true, demoInput(evidence.payload));
}
