# Open questions

## MVP v2 — blocking questions (2026-10-16)

Current direction: [court-first/manual QRIS decision](decisions/004-court-first-manual-qris.md). Phase 1 is customer court ordering only; counter, pickup and dine-in rules are deferred to Phase 2.

- **MERCHANT ACCESS — OPEN:** Which employees may check official merchant records, on which devices, and how is access controlled? Do not assume delivery employees have access or share merchant credentials.
- **MERCHANT EVIDENCE — OPEN:** Does the existing system show a stable transaction reference, actual amount and payment timestamp? What trusted evidence can link a particular payment to a particular order, including simultaneous equal-value orders and reused receipts?
- **MERCHANT TIMING — OPEN:** Is confirmation immediate? How do staff distinguish successful, pending, missing and delayed transactions? What happens at court when records cannot be checked?
- **IMPLEMENTATION BLOCK:** Do not implement payment verification until the above capabilities and the authorized checking procedure are confirmed. No unrestricted mark-paid action or simulated production evidence. Full payment/handover acceptance and real-customer use remain gated.
- **COURT OPERATIONS — OPEN:** No automatic cancellation and immediate unpaid preparation eligibility are now confirmed in decision 005. Staff aging/escalation thresholds, suspicious-order review procedures, production quantities/abuse limits, post-claim cancellation/loss disposition, contact attempts, wrong-court corrections, returned drinks and pause effects on queued/preparing/delivering orders. Supervisor/owner authority is approved; operational grounds and procedures are not all settled.
- **FINANCIAL PROCEDURES — OPEN:** Verifier role matrix; manual mismatch/extra/late payment handling; correction of erroneous confirmations; full-refund execution/evidence and unknown results; merchant reconciliation ownership/frequency; exact paid-order/best-seller/cancellation report definitions. Do not invent fields or merchant support.
- **PHASE 2 — DEFERRED:** Counter-created delivery payment timing, customer/counter pickup and dine-in payment/handoff rules. The earlier answer “yes” did not select among those alternatives; the owner subsequently confirmed deciding these in Phase 2.

Confirmed exception permissions, pre-claim customer cancellation and app-style bright professional UI are recorded in the v2 decision; they are not open questions.

## Before production use

- Secure first-owner provisioning and employee account lifecycle; no production provisioning command exists in Milestone 1.
- Password recovery/delivery and owner/supervisor MFA policy.
- Hosting, trusted proxy/client-IP handling, HTTPS, secret rotation, backups and demonstrated recovery targets.
- Separate least-privilege production runtime and migration database credentials; local database owners are not a production permission design.
- Production throttling tuning and retention/cleanup of expired sessions/rate-limit records.
- Remaining operational permission matrix; Milestone 3 adds explicit counter entry/own-unpaid cancellation and owner/supervisor review/demo controls. Preparation/delivery execution and account-management UI remain later milestones.

Remaining payment/order/location/reporting decisions remain in `DECISIONS.md` O01–O16, as revised by the v2 decision above. They are not silently resolved by the foundation.

Milestone 2 settles fixed final-inclusive prices, deferred variants, bilingual UI and owner-only directory management starting empty; see `decisions/002-catalog.md`. Real menu content/translations and locations must be supplied by the owner before customer use.

Milestone 3's implemented demo behavior is historical, documented in `decisions/003-ordering-proposal.md`. Its universal payment-first/15-minute expiry assumptions are superseded for v2 court orders. No discounts/zero-price checkout, frozen prices and 24-hour private guest access remain unchanged. Staff-assisted lost-link recovery and privacy/retention obligations remain open. Existing demo throttles are not validated production throughput settings.
