# MVP v2 — Court first, manual merchant verification

**Confirmed requirements:** 2026-10-16. **Implementation at original decision:** not started. Subsequent V2-1 approval/implementation is recorded in [decision 005](005-court-ordering.md); this decision never authorizes deployment or blocked payment verification.

## Confirmed changes

- Develop and test customer court ordering first (Phase 1). Counter ordering, pickup and dine-in are deferred to Phase 2; their detailed rules will be decided then. Preserve existing records and reusable code rather than silently deleting those features or treating them as Phase 1 acceptance.
- A court customer scans the ordering QR, confirms/corrects the building and court, chooses available drinks, supplies a name and submits without an account. Retain the existing required court phone contact unless explicitly changed. Only a committed submission receives a unique reference and successful confirmation; an uncertain network response requires safe retry/status recovery.
- Court orders may be prepared before payment. Preparation and delivery employees claim separate tasks, with one current assignee per task. The delivery employee brings the drink and the café's official merchant QRIS. Payment is collected and verified at delivery before ordinary handover/completion.
- Use the café's existing official QRIS merchant system. No payment gateway, webhooks or automated refunds in this MVP. A customer assertion or screenshot is insufficient: an authorized employee must check a trusted official merchant record before marking an order paid.
- Record payment status, amount, method, verifying employee and timestamps. Merchant-specific identifiers/evidence fields depend on the operational review below; do not assume they exist. Keep payment and fulfillment separate and preserve immutable item/price and financial audit history.
- Only supervisors/owners may approve unpaid handover, cancellations after preparation, and externally performed full refunds. Record actor and reason. An unpaid handover or prepared drink loss is a separately tracked exception, never a paid sale. Approval alone does not establish payment or refund execution.
- Customers may cancel only before preparation is claimed. Claim/cancel races must have one authoritative outcome. Existing supervisor/owner-only reassignment after a physical-progress check and no automatic claim expiry remain in force.
- Support multiple employees per role, database-backed queues with polling recovery, submission/action idempotency, service controls, basic owner reporting and outage/manual reconciliation. Detailed operational permissions and unresolved behavior remain in `../OPEN_QUESTIONS.md`.
- UI must be intuitive, mobile-first and app-like, with a bright professional color scheme and DoorDash-inspired ordering simplicity. Use original branding, clear action labels and progressive disclosure; ordinary ordering/fulfillment must not expose simulator controls or a dense management dashboard. Bahasa Indonesia/English and accessibility remain required.

## Explicit merchant-review block

The owner confirmed that all of the following are **OPEN**:

1. Which employees can access official merchant transaction records, on which devices and with what permissions.
2. Whether a stable transaction reference, payment amount and payment timestamp are available.
3. Whether successful confirmation is available immediately and how pending/delayed records appear.

**Do not implement the payment-verification workflow until the merchant system's actual behavior and staff procedure are confirmed.** Do not add a generic mark-paid button, manufacture merchant references or treat a test success as merchant evidence. Preparation/delivery development can be tested independently with labelled non-production fixtures, but final paid handover, end-to-end payment acceptance and real-customer testing remain blocked. A privileged unpaid exception is not a substitute for resolving this block.

After review, approve the evidence/matching rules, verifier permissions, concurrent same-amount payment matching, reuse prevention, unavailable-record handling, correction/reconciliation procedure and external refund evidence before that implementation. This review establishes a human verification procedure, not automatic bank verification.

## Superseded and retained decisions

- B06's universal payment-before-preparation rule is replaced for Phase 1 court orders. Ordinary handover requires verified payment; approved unpaid exceptions remain unpaid.
- B23's automatic-verification condition and B32's mandatory gateway integration before pilot are superseded. QRIS-only, no screenshot-only proof, and separation of simulated versus real records remain required. A proven official manual verification procedure replaces the integration launch gate.
- B34's 15-minute demo payment expiry, demo-driven kitchen release and guest cancellation while any order is unpaid are historical Milestone 3 rules, not the new court policy. New order-aging/payment-deadline rules remain OPEN; retain the 24-hour private guest access policy independently of payment deadlines.
- B24/B25 still require traceable late/extra payments, authorized refunds and reconciliation of unknown outcomes. Exact manual handling must be resolved before affected implementation; no automatic refund execution is implied.
- B27's conservative outage acceptance limits remain until a separate outage procedure is approved. Normal online court preparation before payment does not automatically authorize offline preparation without verification.
- Foundations, exact IDR arithmetic, server-side authorization, frozen checkout snapshots, account/session security, privacy, recovery targets and deferred inventory/accounting remain unchanged. B31's one-hour recovery/no permanent paid-order-detail loss target is still unproven.

## Boundary and next work

At this decision, only requirements/plan documentation was changed. V2-1 subsequently implemented court ordering under decision 005; previous Milestone 3 tests remain historical evidence for the earlier demo. See `../implementation-plan.md` for the proposed two-phase sequence and `../ACCEPTANCE.md` for unexecuted v2 gates. Further implementation and real-money use need their own approved scope.
