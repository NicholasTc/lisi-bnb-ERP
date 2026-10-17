# LISI BNB ERP — Product Scope

**Updated:** 2026-10-16. **Status:** MVP v2 requirements confirmed; V2-1 local court ordering implemented for owner review; later operations/payment stages not started. No production/pilot authorization.

The [court-first/manual QRIS decision](docs/decisions/004-court-first-manual-qris.md) supersedes conflicting v1 payment rules. [DECISIONS.md](docs/DECISIONS.md) distinguishes confirmed, superseded and open items. The application now provides V2-1 local court checkout; retained v1 payment simulation cannot establish payment on these new orders. See [decision 005](docs/decisions/005-court-ordering.md).

## Purpose

One café/kitchen serves customers at padel and tennis courts across multiple buildings. Build the smallest reliable responsive web application for ordering drinks, employee preparation/delivery, trusted manual QRIS verification and basic owner reporting. Prioritize security, financial correctness, recoverability and operational simplicity.

## Phase 1 — Customer court ordering first

- Court-specific QR preselects a validated building/court; customer can correct and explicitly confirm it.
- Bilingual Bahasa Indonesia/English menu, cart and guest submission; retain required name and court phone contact, final inclusive integer-IDR prices, availability checks and immutable order snapshots. No customer account.
- A committed order receives a unique reference, confirmation and private progress/recovery access. Safe retries must not duplicate orders; failed/uncertain submissions must not display unearned success.
- Court orders enter preparation before payment. Multiple preparation/delivery employees use shared durable queues with exclusive task claims, separate preparation and delivery ownership, and polling recovery.
- Customer pays using the café's existing official merchant QRIS at delivery. Ordinary handover/completion requires payment verified against trusted official merchant records. No customer screenshot/assertion alone establishes payment.
- Record payment status, amount, method, verifying employee and timestamps; never count unverified orders as collected revenue. Merchant-specific evidence/identifiers depend on actual capabilities.
- Only supervisors/owners authorize unpaid handover, cancellation after preparation and externally performed full refunds; record reasons and actors. Track unpaid prepared orders/handovers separately as losses or exceptions, never paid sales. Customers may cancel only before preparation is claimed.
- Retain individual employee accounts, multiple roles, server-side least privilege and supervised reassignment after a physical check; no automatic claim expiry.
- Owner menu/price/building/court/QR-destination management and authorized availability controls; role-defined service pauses and basic reports. Detailed pause/exception/report definitions remain open.
- Intuitive, mobile-first, bright professional app-style UI inspired by DoorDash's ordering simplicity, with original branding. Focus on the next action; keep technical/test controls out of normal customer and employee tasks. Preserve accessibility and clear loading/offline/error/empty states.

**Payment-verification implementation is blocked.** Employee merchant access, stable transaction reference/amount/time availability and confirmation speed are explicitly OPEN. Do not implement that workflow until the official merchant system and staff procedure are confirmed. Court ordering/operations may be developed and tested independently with labelled non-production data; full payment/handover acceptance and real-customer use remain blocked. See [OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).

## Phase 2 — Counter, pickup and dine-in

Build after Phase 1 is tested/accepted and the owner approves proceeding. Decide detailed payment timing, permissions and handoff rules then, including counter-entered court deliveries. Existing counter/pickup/dine-in code and historical data are reusable; their existence does not put them in Phase 1 or establish v2 acceptance. Do not delete records to narrow the UI.

## Financial and reliability boundaries

- QRIS only; cash/EDC remain deferred. No gateway, webhooks or automated refunds in this MVP. External full refunds still require authorization, verified execution evidence and auditable recording; detailed procedures remain open.
- Exact IDR arithmetic, separate payment/fulfillment status, transactional writes, constraints, immutable snapshots/history, idempotency, current server-side authorization and reconciliation remain essential.
- Simulated records must stay labelled, isolated from real sales and unavailable as production payment evidence. Existing demo success proves no merchant capability.
- Reports use Asia/Jakarta midnight-to-midnight. Distinguish verified collections, confirmed refunds, outstanding unpaid orders, unique paid orders, best sellers, cancellations and unpaid prepared-order exceptions; detailed formulas/recognition rules require approval. Merchant settlement is separate.
- Manual outage log and official merchant tools remain required. Preserve B27's conservative limit: stop new outage orders if official payment verification is unavailable until an alternative outage policy is approved. Reconcile overlaps without duplicate fulfillment or collections.
- Recovery target remains digital service within one hour and no permanent loss of paid-order details. This is unproven until restore/reconciliation drills pass; define other-record RPOs and recovery ownership.

## Retained architecture and exclusions

Approved modular monolith: TypeScript/Next.js, PostgreSQL, Drizzle, Tailwind, Vitest/Playwright and reviewed Better Auth. Hosting remains unselected; no additional infrastructure is implied.

Defer automated QRIS integration, customer registration/loyalty/subscriptions, advanced inventory/ingredient deductions/accounting, AI/forecasting/recommendations, complex discounts/variants/modifiers, native apps and multi-branch ERP. Substitutions, partial fulfillment/refunds and zero-price/discount checkout remain outside the approved scope. Record unpaid loss exceptions without introducing inventory valuation or accounting.

## Release and change control

Requirements approval is not implementation or deployment approval. Follow the [two-phase plan](docs/implementation-plan.md), resolve blockers before their affected work and approve each implementation stage separately. Full court testing includes merchant verification proof; independent ordering tests alone do not establish payment readiness. Complete security, production employee provisioning, backups/restores, reconciliation, staff training and a separately approved controlled court pilot before public launch. Phase 2 has its own acceptance gate.
