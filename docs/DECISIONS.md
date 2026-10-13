# LISI BNB ERP — Decision Register

**Status:** Living register. Use this document to resolve ambiguity; do not interpret proposals as approvals.  
**Updated:** 2026-10-13

## Status meanings

- **CONFIRMED:** Explicitly selected by the user.
- **PROPOSED:** Recommended, but not approved.
- **OPEN:** Needs a decision, evidence or business input.
- **SUPERSEDED:** Replaced by a later explicit decision.

## Confirmed business decisions

| ID | Status | Decision |
|---|---|---|
| B01 | CONFIRMED | One café and kitchen serving multiple padel/tennis buildings. |
| B02 | CONFIRMED | Court delivery, café pickup and dine-in supported. |
| B03 | CONFIRMED | Café counter supports both QR self-ordering and employee-entered orders. |
| B04 | CONFIRMED | Court-specific QR preselects court; customer can override. |
| B05 | CONFIRMED | Guest checkout; no customer account required. |
| B06 | CONFIRMED | Payment is required **before preparation**; paid orders enter kitchen automatically after trusted verification. |
| B07 | CONFIRMED | Preparation and delivery are separate roles, with potentially multiple employees per role. |
| B08 | CONFIRMED | Shared queues; employees claim their own preparation/delivery tasks. |
| B09 | CONFIRMED | Ready court orders go to delivery queue; pickup/dine-in use ready/handoff flow. |
| B10 | CONFIRMED | Staff can pause services and adjust wait estimates. |
| B11 | CONFIRMED | Only supervisor and owner can authorize cancellations/refunds. |
| B12 | CONFIRMED | Preparation staff and owner can change product availability. |
| B13 | CONFIRMED | Owner dashboard: today's revenue, order count, best sellers, order history. |
| B14 | CONFIRMED | Role-based permissions: preparation, delivery, supervisor, owner. |
| B15 | CONFIRMED | Live dashboard with audible and visual new-order alerts. |
| B16 | CONFIRMED | During outage, use manual order log and existing merchant payment tools; reconcile later. |
| B17 | CONFIRMED | Support café device and employee smartphones. |
| B18 | CONFIRMED | Responsive website for customer, staff and owner. |
| B19 | CONFIRMED | One integrated application with separate ordering, payment, operations and reporting modules. |
| B20 | CONFIRMED | Rollout: internal testing → limited real-order pilot → public launch. |
| B21 | CONFIRMED | Launch requires verified payments, end-to-end tests, role security, recovery and staff training. |
| B22 | CONFIRMED | **MVP first**, then advanced inventory and accounting after MVP testing/stabilization. |

## Superseded decision

| ID | Status | Prior decision | Superseded by |
|---|---|---|---|
| S01 | SUPERSEDED | Round 4 originally selected inventory and accounting in initial release. | B22: defer advanced inventory/accounting until after operational MVP is tested. |

## Payment concept: understood, not selected

- **CONFIRMED INTENT:** Customer scans an ordering QR and may see/save a **separate QRIS payment image** for payment using BCA/myBCA or similar.
- **OPEN:** Whether merchant uses BCA Merchant, GoPay Merchant, GoMerchant or another service; whether dynamic QRIS/API and verified callbacks are available. No claim that any particular provider is supported or integrated.
- **OPEN:** Counter tenders, manual verification, settlement, expiration, refunds, fees, payout delays and provider outages.

## Proposed design choices (not yet confirmed)

| ID | Status | Proposal |
|---|---|---|
| P01 | PROPOSED | Separate payment and fulfillment state machines with explicit transitions. |
| P02 | PROPOSED | Atomic employee claims and controlled reassignment. |
| P03 | PROPOSED | Maintain immutable/append-only financial event history or equivalent auditable ledger of changes. |
| P04 | PROPOSED | PostgreSQL as authoritative store; Google Sheets as optional read-only reporting mirror, not a writable second operational DB. **No database selected.** |
| P05 | PROPOSED | Manual fallback records use unique identifiers and explicit reconciliation states. |
| P06 | PROPOSED | Defer loyalty, court bookings, payroll, supplier automation, multi-location and forecasting. |
| P07 | PROPOSED | Use a mock payment provider in non-production environments only; real provider verified before pilot. |

## Open decision backlog

| Priority | ID | Question / required evidence |
|---|---|---|
| BLOCKER | O01 | Which official merchant/payment integration can reliably verify QRIS payments? Obtain documentation and merchant approval. |
| BLOCKER | O02 | What are exact payment/order states, permitted transitions, cancellations, refunds, and duplicate/late payment policies? |
| BLOCKER | O03 | Which payment methods are accepted for staff-entered orders? Who can confirm them? |
| BLOCKER | O04 | What buildings/courts exist? QR-to-court mapping, dine-in identifiers and delivery limits? |
| BLOCKER | O05 | What menu, product variants/modifiers, prices, discounts and tax/service rules apply? |
| BLOCKER | O06 | What roles may enter orders, pause services, reassign tasks, edit locations, see financial data, and adjust availability? |
| BLOCKER | O07 | What is the manual outage ledger and payment-verification/reconciliation procedure? |
| BLOCKER | O08 | What exactly counts as revenue, an order, a refund and a business day in reports? |
| BLOCKER | O09 | What are operational failure thresholds, notification fallback and staff escalation paths? |
| BLOCKER | O10 | What security/privacy/retention/provider obligations apply to the business in Indonesia? |
| HIGH | O11 | Database, hosting, backups/restore, monitoring and optional Sheets mirror. |
| HIGH | O12 | Device/browser/network requirements, expected peak throughput and latency targets. |
| HIGH | O13 | Guest order lookup, receipts, customer support contact and wrong-court correction. |
| HIGH | O14 | Delivery handoff failure, pickup identity, claim timeout and shift change. |
| HIGH | O15 | Product sold-out timing, order edits, partial fulfillment and substitutions. |
| LATER | O16 | Advanced inventory scope and accounting depth after MVP stabilization. |

## Decision process

For each open issue record: decision, approver, date, reason, affected workflow/tests, and superseded decision (if any). A Codex agent must ask rather than fill in a BLOCKER with assumptions. Payment-provider selection is deferred during design, **not optional for real-money pilot or launch**.
