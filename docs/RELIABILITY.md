# LISI BNB ERP — Reliability and Recovery Requirements

**Status:** Safety baseline and proposed controls; detailed mechanisms require technical design approval.  
**Updated:** 2026-10-13

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

## 3. Failure scenarios and required outcomes

| Failure | Expected safe behavior | Detection / recovery |
|---|---|---|
| Payment succeeds; customer browser closes | Order remains recoverable; kitchen receives it once verification is established. | Provider verification + reconciliation; customer order lookup. |
| Payment callback delayed/lost | Do not guess payment; reconcile with provider and release order when verified. | Pending-payment aging alerts, periodic reconciliation. |
| Payment callback repeated/out of order | Process idempotently; reject invalid regressions. | Deduplication keys, event audit. |
| Customer pays twice | Do not prepare duplicate order automatically; investigate/refund per approved policy. | Provider transaction matching and exception queue. |
| QR payment expires / payment fails | Keep order out of kitchen; show recoverable state. | Expiration/retry handling; exact policy OPEN. |
| Two staff claim same task | At most one successful claim. | Atomic conditional update and conflict feedback. |
| Staff loses connection during status update | No phantom success; reload authoritative status and retry safely. | Idempotent actions and state refresh. |
| Notification sound fails/device muted | Order remains visible in queue; staff can refresh/check. | Visual indicator, heartbeat/staleness banner; escalation OPEN. |
| Product sold out after cart created | Prevent invalid checkout or apply approved exception/refund flow. | Revalidate availability before accepting order. |
| Wrong delivery location / customer absent | Preserve order, flag exception, allow authorized correction. | Delivery exception workflow; policy OPEN. |
| Refund issued after order recorded | Keep original sale and separate refund event; reporting adjusts correctly. | Reconciliation and audit trail. |
| App/network outage | Manual order log and official merchant tools; do not rely on ERP availability. | Outage checklist and post-recovery reconciliation. |
| Primary data store failure | Stop unsafe writes; restore from tested backup and reconcile payments/orders. | Backups, restore drill, monitoring; targets OPEN. |
| Google Sheets sync fails (if added) | ERP keeps working; Sheets clearly show stale last-sync time. | Retry, lag monitoring, reconciliation. |
| Reporting disagrees with merchant | Do not silently overwrite; surface discrepancy for investigation. | Daily reconciliation report. |

## 4. Resilience mechanisms — design requirements, not stack choices

### Payments and orders
- Trusted provider-side payment verification, signed/authenticated notifications where supported, replay protection, and reconciliation.
- Idempotency for checkout creation, payment callbacks, refunds and employee state changes.
- Durable record of order/payment linkage and every meaningful state change.
- Retriable background processing where needed; failed operations observable rather than silently dropped.
- Never treat frontend confirmation as payment authority.

### Operations
- Server-authoritative order state and atomic task claims.
- Visual indicators plus audible alerts; no assumption that sound will always play.
- Explicit stale/offline UI indication, safe retries and employee-visible exceptions.
- Manual service pause and wait estimate controls with clear impact on new vs existing orders.

### Data protection and recovery
- Automated backups, restricted access, restore drills and documented recovery ownership.
- Define and test recovery point objective (RPO) and recovery time objective (RTO) before launch; **not yet chosen**.
- Separate environments for development, staging and production; no mock payments in production.
- Monitoring and alerts for payment verification delays, queue lag, order processing failures, synchronization and database health.
- Google Sheets may later serve as a **read-only reporting mirror**; it is not an authoritative database or substitute for backups.

### Security and audit
- Least-privilege role checks enforced on the server.
- Protect credentials and personal information; minimize collection, define retention, and follow applicable Indonesian law and provider agreements.
- Record actor, timestamp, before/after or event details for refund/cancellation, price/availability changes, location correction and inventory/accounting actions when added.
- Avoid storing raw sensitive payment credentials.

## 5. Manual fallback — mandatory runbook to finish before pilot

**Confirmed direction:** Separate manual order log + existing merchant payment tools, then reconcile.

**Runbook requirements (OPEN until approved):** Who declares outage; how new orders are numbered; required fields (time, items, amount, service type, location, staff, merchant transaction reference, fulfillment); how payments are verified when connectivity is impaired; how to prevent duplicated fulfillment; who imports/reconciles records; how discrepancies are escalated; how staff return to normal operation.

Never infer that a manual payment is verified merely because a customer presents a screenshot. If official merchant confirmation is unavailable, follow an explicitly approved contingency policy; no such policy is confirmed yet.

## 6. Failure drills and release gating

Before limited real-order pilot, demonstrate: delayed/duplicate payments, customer browser exit, concurrent staff claims, offline device during status change, wrong court, refund authorization, service pause, merchant outage, manual-order reconciliation, and backup restoration. Use actual payment-provider sandbox and controlled real-money validation where permitted. See `ACCEPTANCE.md`.

## 7. Ownership and escalation — open

Name an operational owner for payment discrepancies, kitchen queue incidents, delivery exceptions, infrastructure alerts, backup restoration and daily reconciliation. Define contact paths and response targets before pilot. Technical success is not enough without trained staff and a documented recovery procedure.
