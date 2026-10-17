# 006 — V2-2 court preparation

**2026-10-17.** V2-2 authorized; the owner confirmed these rules before implementation:

- Preparation-role employees and owners may claim, prepare, mark ready, flag for review and pause/resume new court orders. Supervisors may view; they need the preparation role to work orders. No implicit role hierarchy.
- Pausing blocks new court submissions, persists until explicit resume and leaves existing work visible/preparable. A retry of an already-committed checkout still recovers its order.
- Preparation staff/owners may hold an unclaimed order, or their own claimed order, for suspicious/unavailable work with a required reason. No substitution, partial fulfillment or automatic cancellation. Supervisor resolution/reassignment/post-claim cancellation remains V2-3.

## Implemented boundary

Non-production court states: `awaiting_preparation → preparing → ready`; `awaiting_preparation → canceled` by private guest cancellation; `awaiting_preparation/preparing → exception` for review. Only the current authorized assignee marks ready or holds claimed work. Ownership never expires automatically. Ready means physically prepared, not handed over or paid. Review is a hold, not a sale or financial adjustment.

Claims/cancel/ready/review serialize on the order row. Durable command IDs bind the canonical action and authenticated actor; the command, state change and attributed order event commit together. Identical replay acknowledges the prior action without resetting later progress; reused identities with different content/actors fail. Service versions reject stale pause changes. SQL constraints/triggers protect state/ownership/timestamps, snapshots and atomic audit requirements. New migration 0007 preserves prior records and v1 demo payment rules.

The protected preparation API rechecks enabled identity, session and current roles inside the action transaction. Passive reads never extend inactivity. The staff DTO omits phone, recovery credentials and financial evidence; internal review reasons are omitted from guest responses. Checkout replay also enforces the existing 24-hour private-access deadline.

The ID/EN task screen follows the existing customer palette and progressive disclosure. Local engineering settings are polling every 5 seconds, a stale warning/action block after 15 seconds without success, 10-second request timeout and oldest-first pages of at most 50 orders. These are test defaults, **not approved production freshness/capacity targets**. Polling/manual refresh and visual state work with blocked/muted audio; optional sound requires a user gesture and is supplementary. Failed or ambiguous actions retain the exact employee-scoped retry command across reloads. Revoked access clears visible work and stored commands; logout clears preparation drafts.

Production ordering/operations remain closed. No delivery, reassignment, review resolution, account-management UI, payment verification, collection/reporting, counter/pickup/dine-in or deployment is added. Merchant access/evidence/timing remains a hard gate. Real-device sound/usability and production freshness targets require owner acceptance. Verification: [V2-2 evidence](../VERIFICATION-V2-2.md).
