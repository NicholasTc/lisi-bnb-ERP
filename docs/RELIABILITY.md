# LISI BNB ERP — Reliability and Recovery Requirements

**Status:** Safety baseline and proposed controls; detailed mechanisms require technical design approval.  
**Updated:** 2026-10-13

Owner-approved business defaults are recorded in `DECISIONS.md` B23–B31. Mechanisms and unresolved details remain subject to design; approval is not evidence that recovery or provider capabilities work.

## 1. Reliability objective

This is a real-money, real-food ordering system. We cannot promise zero incidents. Design for **prevention, detection, containment, recovery and auditability**, especially when customers have paid. Redundancy must not create two competing sources of payment/order truth.

## 2. Non-negotiable invariants

1. **No unverified payment may trigger preparation.** Customer screenshots, redirects and self-reported success are insufficient.
2. Every paid order must be durably identifiable and recoverable even if the browser closes or a worker/device crashes.
3. A duplicate provider callback, retry or double-click must not create a second paid order or duplicate revenue.
4. A single preparation/delivery task cannot be concurrently claimed by two employees.
5. Order amount and item-price snapshots must not silently change when menu prices change later.
6. Cancellation/refund authorization must be enforced server-side and leave an auditable record.
7. Existing paid orders must not disappear when ordering is paused or products become unavailable.
8. Manual orders and recovered online orders must not be counted twice.
9. A report must distinguish payment verification, refund status and fulfillment status; fulfillment is not proof of settlement.
10. Secrets, credentials and sensitive payment details must not be exposed in client code or logs.
11. Reassignment requires supervisor/owner confirmation of physical progress; no automatic claim expiry. A previous assignee cannot continue changing the reassigned task.
12. Canceled/expired or already manually fulfilled orders must not re-enter preparation merely because payment verification arrives later.
13. Unknown refund outcomes require reconciliation before retry; concurrent actions must not create duplicate or excessive refunds.

## 3. Failure scenarios and required outcomes

| Failure | Expected safe behavior | Detection / recovery |
|---|---|---|
| Payment succeeds; customer browser closes | Order remains recoverable; eligible orders reach kitchen once verified. | Provider verification + reconciliation; secure guest lookup remains OPEN. |
| Payment callback delayed/lost | Do not guess payment; reconcile and release only if still eligible. Late canceled/expired payments require supervisor review, defaulting to refund. | Pending-payment aging alerts, periodic reconciliation; preserve late evidence. |
| Payment callback repeated/out of order | Process idempotently; reject invalid regressions. | Deduplication keys, event audit. |
| Customer pays twice | One fulfillment only; supervisor/owner-authorized refund of the extra verified payment. | Match distinct financial transactions; preserve both receipts and refund history. |
| QR payment expires / payment fails | Keep order out of kitchen; show recoverable state. | Expiration/retry handling; exact policy OPEN. |
| Two staff claim same task | At most one successful claim. | Atomic conditional update and conflict feedback. |
| Claimed work is stale or employee changes shift | Supervisor/owner checks physical progress before release/reassignment; no automatic expiry. | Reject former-assignee actions; shift/handoff procedure OPEN. |
| Staff loses connection during status update | No phantom success; reload authoritative status and retry safely. | Idempotent actions and state refresh. |
| Notification sound fails/device muted | Order remains visible in queue; staff can refresh/check. | Visual indicator, heartbeat/staleness banner; escalation OPEN. |
| Product sold out after cart created | Prevent invalid checkout or apply approved exception/refund flow. | Revalidate availability before accepting order. |
| Fulfillment impossible after payment | Supervisor resolves through full refund and replacement-order offer; no substitution/partial fulfillment in MVP. | Retain paid-order details and linked refund; no automatic replacement charge. Pending-payment stock-out policy OPEN. |
| Wrong delivery location / customer absent | Preserve order and flag exception. Supervisor manages location corrections. For absent customer, attempt agreed contact and return to café; do not auto-complete. | Contact method, correction limits and final redelivery/refund procedure OPEN. |
| Refund issued after order recorded | Keep original sale and separate refund event; reporting adjusts correctly. | Reconciliation and audit trail. |
| Refund request succeeds but response is lost | Keep result pending/unknown until reconciled; do not blindly issue another refund. | Operation/transaction linkage, safe retries and excess-refund prevention. Provider mechanism OPEN. |
| App/network outage | Supervisor-numbered manual log and official merchant tools. Stop new orders if payment cannot be verified; continue already verified work. | Designated supervisor resolves overlap and approves online resumption; cutover details OPEN. |
| Primary data store failure | Stop unsafe writes; recover complete paid-order details and reconcile financial/physical work before safe resumption. | Target digital recovery within one hour, no permanent loss of paid-order details; prove feasibility in restore drills. Other RPOs/measurement details OPEN. |
| Google Sheets sync fails (if added) | ERP keeps working; Sheets clearly show stale last-sync time. | Retry, lag monitoring, reconciliation. |
| Reporting disagrees with merchant | Do not silently overwrite; surface discrepancy for investigation. | Daily reconciliation report. |

## 4. Resilience mechanisms — design requirements, not stack choices

### Payments and orders
- Trusted provider-side payment verification, signed/authenticated notifications where supported, replay protection, and reconciliation.
- Idempotency for checkout creation, payment callbacks, refunds and employee state changes.
- Durable record of order/payment linkage and every meaningful state change.
- Retriable background processing where needed; failed operations observable rather than silently dropped.
- Never treat frontend confirmation as payment authority.

### Demo-first development and production separation — B32
- A replaceable provider boundary separates provider-specific payment creation, event verification, status lookup/reconciliation and refund integration from core order rules. Its exact contract remains to be designed from business requirements and later checked against official provider capabilities.
- Demo controls produce explicit simulated evidence server-side and exercise the same business-rule processing path, including retries and failure cases; they must not bypass payment/order integrity checks.
- Demo displays/records are clearly labeled, payment displays are non-payable, and data is isolated from production transaction history and reporting. Simulated success is not verified merchant payment evidence.
- Production rejects demo configuration, endpoints/controls and simulated evidence, including attempts through direct requests. Missing/invalid real-provider configuration disables payment acceptance; it cannot activate demo mode.
- Use a common provider-independent test suite for demo and the eventual real adapter, plus provider-specific authentication/integration tests. Demo tests cannot validate actual QRIS, webhook authentication, refunds, settlement or merchant onboarding.
- Real integration and controlled live verification remain pilot gates. Replaceability reduces coupling; it does not guarantee no later changes or remove provider integration/testing work.

### Operations
- Server-authoritative order state and atomic task claims.
- Visual indicators plus audible alerts; no assumption that sound will always play.
- Explicit stale/offline UI indication, safe retries and employee-visible exceptions.
- Manual service pause and wait estimate controls with clear impact on new vs existing orders.

### Data protection and recovery
- Automated backups, restricted access, restore drills and documented recovery ownership.
- **Approved target (B31):** Digital service recovery within one hour, with no permanent loss of paid-order details. This is a business target, not a validated architecture guarantee. Define measurement boundaries and RPO for other records before pilot; test recovery feasibility.
- Merchant payment references alone cannot reconstruct lost items, quantities, locations or physical fulfillment. A restore drill must include complete paid-order records and events after the backup point, with prevention of repeated fulfillment/refunds before resumption.
- Separate environments for development, staging and production; no mock payments in production.
- Monitoring and alerts for payment verification delays, queue lag, order processing failures, synchronization and database health.
- Google Sheets may later serve as a **read-only reporting mirror**; it is not an authoritative database or substitute for backups.

### Security and audit
- Least-privilege role checks enforced on the server.
- Apply B28's approved permission direction and individual employee accounts on shared devices. Full permissions, session switching, revocation and recovery procedures remain OPEN.
- Protect credentials and personal information; minimize collection, define retention, and follow applicable Indonesian law and provider agreements.
- Record actor, timestamp, before/after or event details for refund/cancellation, price/availability changes, location correction and inventory/accounting actions when added.
- Avoid storing raw sensitive payment credentials.

## 5. Manual fallback — mandatory runbook to finish before pilot

**Confirmed direction (B27):** Separate supervisor-numbered manual log + existing merchant tools. Accept new manual orders only with official merchant payment verification; otherwise stop new orders and continue already verified work. A designated supervisor resolves overlaps and approves online resumption.

**Runbook details (OPEN until approved):** Named supervisor and outage-declaration authority; numbering format; fields (time, items, amount, service type, location, staff, merchant transaction reference, fulfillment); evidence checks; partial outage with server still accepting orders; physical fulfillment overlap; import permissions; reconciliation deadlines; discrepancy escalation; resumption checks.

Never infer that a manual payment is verified merely because a customer presents a screenshot. If official merchant confirmation is unavailable, stop accepting new orders; no unverified-payment contingency is approved.

## 6. Failure drills and release gating

Before limited real-order pilot, demonstrate: delayed/duplicate payments, customer browser exit, concurrent staff claims, offline device during status change, wrong court, refund authorization, service pause, merchant outage, manual-order reconciliation, and backup restoration. Use actual payment-provider sandbox and controlled real-money validation where permitted. See `ACCEPTANCE.md`.

Demo drills may exercise provider-independent behavior before merchant selection, but do not satisfy provider-specific or real-money release evidence. Repeat applicable payment tests against the selected real integration before pilot.

## 7. Ownership and escalation — open

Name an operational owner for payment discrepancies, kitchen queue incidents, delivery exceptions, infrastructure alerts, backup restoration and daily reconciliation. Define contact paths and response targets before pilot. Technical success is not enough without trained staff and a documented recovery procedure.
