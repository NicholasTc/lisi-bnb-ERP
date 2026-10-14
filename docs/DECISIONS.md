# LISI BNB ERP — Decision Register

**Status:** Living register. Use this document to resolve ambiguity; do not interpret proposals as approvals.  
**Updated:** 2026-10-14

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
| B06 | CONFIRMED | Payment is required **before preparation**; eligible paid orders enter kitchen automatically after trusted verification. B24 and B27 exclude late canceled/expired or already manually fulfilled work from automatic release. |
| B07 | CONFIRMED | Preparation and delivery are separate roles, with potentially multiple employees per role. |
| B08 | CONFIRMED | Shared queues; employees claim their own preparation/delivery tasks. |
| B09 | CONFIRMED | Ready court orders go to delivery queue; pickup/dine-in use ready/handoff flow. |
| B10 | CONFIRMED | Staff can pause services and adjust wait estimates. |
| B11 | CONFIRMED | Only supervisor and owner can authorize paid cancellations/refunds. B25 also supports unpaid cancellation; detailed unpaid actor rules remain OPEN. |
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
| B23 | CONFIRMED | MVP accepts QRIS only, including counter orders, conditional on trusted automatic verification. Cash/EDC are deferred. No provider selected. |
| B24 | CONFIRMED | Late payments for canceled/expired orders require supervisor review, with refund as the default rather than automatic preparation. Refund the extra verified payment on duplicate payment; never duplicate fulfillment. |
| B25 | CONFIRMED | Unpaid orders may be canceled. Paid cancellations/refunds require supervisor/owner approval; full cancellation is normally allowed before preparation, and exceptions after preparation starts require individual review. Partial refunds are deferred. Uncertain refund results remain pending reconciliation before retry. |
| B26 | CONFIRMED | Only supervisors/owners release or reassign claimed work, after checking physical progress. No automatic claim expiry; reject subsequent actions from the previous assignee. |
| B27 | CONFIRMED | During outages, accept new manual orders only with official merchant payment verification; otherwise stop new orders and continue already verified work. A designated supervisor numbers manual records, resolves overlap and approves return to online operation. |
| B28 | CONFIRMED | Designated counter staff enter orders; preparation staff control availability and kitchen pauses; supervisors manage service pauses, reassignment and destination corrections; owners control prices, accounts and financial reporting. Supervisor/owner refund authority remains. Use individual accounts on shared devices and server-side authorization. |
| B29 | CONFIRMED | Recheck availability at checkout and freeze agreed prices. If fulfillment becomes impossible after payment, a supervisor resolves it through a full refund and replacement-order offer. Substitutions and partial fulfillment are deferred. |
| B30 | CONFIRMED | Order-specific pickup codes, numbered dine-in tables and explicit building/court confirmation. For absent court customers, record failed delivery, attempt the agreed contact method and return to the café; do not automatically mark delivered. |
| B31 | CONFIRMED | Reporting uses Asia/Jakarta midnight-to-midnight, showing verified payments received, confirmed refunds issued and their difference separately from settlement. Count unique paid orders, not duplicate payments. Recovery target: digital service within one hour, with no permanent loss of paid-order details; feasibility must be demonstrated in drills. |
| B32 | CONFIRMED | Use a demo payment provider for non-production development/testing while merchant selection is pending. Keep provider integration replaceable without rewriting core order logic. Simulated evidence/data must be clearly distinguished and isolated from real transactions; demo mechanisms must be unavailable in production. Official provider integration and verification remain mandatory before a real-money pilot. |

### Approval record — B23–B31

- **Approver/date:** Product owner, 2026-10-13, explicitly accepted all nine recommended MVP defaults in this conversation.
- **Reason:** Resolve critical payment, ownership, outage and operational policy gaps while keeping the MVP small.
- **Affected documents/tests:** `SCOPE.md`, `WORKFLOWS.md`, `RELIABILITY.md`, and `ACCEPTANCE.md` (F03/F06/F10–F14/F16, R02/R08/R11/R13, F18–F20 and R15–R20).
- **Superseded:** Earlier OPEN/proposed entries only to the extent settled by B23–B31. B06 automatic queue entry applies to eligible orders, not canceled/expired or already manually fulfilled orders. No payment-verification exception is approved.
- **Boundary:** Approval establishes requirements and a recovery target, not working provider capabilities, a finalized state machine, proven recovery performance or implementation authorization. Documentation edits only are authorized; no code or technology selection.

### Approval record — B32

- **Approver/date:** Product owner, 2026-10-13: use demo payments first while choosing the merchant, with a replaceable real production integration later.
- **Reason:** Allow provider-independent development/testing to progress without treating merchant selection as a prerequisite for demo work or sacrificing production safeguards.
- **Affected documents/tests:** `SCOPE.md`, `WORKFLOWS.md`, `RELIABILITY.md`, `ACCEPTANCE.md` Gate A, R14, F21 and R21–R22.
- **Superseded/clarified:** P07's mock-provider proposal is now approved through B32. O01 remains a real-integration/pilot blocker, not a blocker for the approved demo path. B23's QRIS-only production scope is unchanged.
- **Boundary:** This records demo-first requirements, not a technology/provider selection, application implementation authorization or a guarantee of zero later integration changes. Other module/business-rule blockers remain open.

## Superseded decision

| ID | Status | Prior decision | Superseded by |
|---|---|---|---|
| S01 | SUPERSEDED | Round 4 originally selected inventory and accounting in initial release. | B22: defer advanced inventory/accounting until after operational MVP is tested. |
| S02 | SUPERSEDED | P07 proposed a mock payment provider in non-production only, with real verification before pilot. | B32 confirms demo-first development/testing and production separation. |

## Payment concept: understood, not selected

- **CONFIRMED INTENT:** Customer scans an ordering QR and may see/save a **separate QRIS payment image** for payment using BCA/myBCA or similar.
- **OPEN:** Whether merchant uses BCA Merchant, GoPay Merchant, GoMerchant or another service; whether dynamic QRIS/API and verified callbacks are available. No claim that any particular provider is supported or integrated.
- **CONFIRMED:** Customer and counter MVP tenders are QRIS only (B23); cash/EDC are deferred. Outage orders require official merchant verification (B27).
- **CONFIRMED:** Demo-first non-production testing is approved (B32). Demo payment displays must be marked simulated/non-payable, and demo success is not evidence of actual QRIS payment or provider support.
- **OPEN:** Provider verification evidence, settlement, expiration mechanics, refund execution/capabilities, fees, payout delays and provider outages. ERP import/manual-confirmation permissions and evidence checks are not yet specified.

## Technical foundation approval — 2026-10-14

Product owner approved Milestone 1 implementation only: TypeScript/Next.js modular monolith, PostgreSQL, Drizzle, Tailwind, Vitest and Playwright; local Docker Compose development/test PostgreSQL. Better Auth is approved subject to configuration and executed security tests. See `decisions/001-foundation.md` for technical boundaries and `OPEN_QUESTIONS.md` for unresolved foundation/launch items.

Confirmed employee policy: individual email/password accounts; no public registration; multiple roles; server-side default-deny authorization; database sessions; eight-hour absolute lifetime without extension; thirty-minute server-side inactivity expiry; immediate logout revocation; disabling revokes sessions. Provisioning is development/test only in this milestone. Payments are entirely disabled for Milestone 1.

This approval supersedes earlier documentation-only authorization boundaries for Milestone 1, but does not approve business-rule implementation, later milestones, production systems or launch.

## Design choice register

| ID | Status | Proposal |
|---|---|---|
| P01 | PROPOSED | Separate payment and fulfillment state machines with explicit transitions. |
| P02 | PROPOSED | Atomic enforcement mechanism remains subject to technical design; exclusive ownership is mandatory. Reassignment business policy is confirmed in B26. |
| P03 | PROPOSED | Maintain immutable/append-only financial event history or equivalent auditable ledger of changes. |
| P04 | CONFIRMED IN PART | PostgreSQL is approved as authoritative store (2026-10-14). Google Sheets remains optional/deferred and read-only, not a writable second operational database. |
| P05 | PROPOSED | Manual fallback records use unique identifiers and explicit reconciliation states. |
| P06 | PROPOSED | Defer loyalty, court bookings, payroll, supplier automation, multi-location and forecasting. |

## Open decision backlog

| Priority | ID | Question / required evidence |
|---|---|---|
| BLOCKER | O01 | Real integration/pilot gate: which official merchant/payment integration reliably verifies QRIS payments? Obtain documentation and merchant approval before real-provider implementation/testing. B32 permits provider-independent demo development without selecting a merchant; demo results do not resolve this gate. |
| BLOCKER | O02 | B24–B26/B29 settle default exception policies. Approve exact states/transitions, late-payment review outcomes, post-preparation cancellation grounds, refund execution/unknown outcomes, and safeguards against excess concurrent refunds. |
| BLOCKER | O03 | QRIS-only counter tender is settled by B23. Define provider evidence, receipt handling and authorized outage-import/payment-verification procedures; no unrestricted manual-paid control. |
| BLOCKER | O04 | B30 settles numbered tables, pickup codes and court confirmation. Supply building/court/table directory, QR mapping, coverage and destination-correction limits by fulfillment stage. |
| BLOCKER | O05 | B29 settles checkout revalidation and frozen agreed prices. Define menu/variants/modifiers, pricing, discounts/tax/service rules, pending-payment availability policy and replacement-order handling. |
| BLOCKER | O06 | B28 settles permission direction and individual identity. Approve the complete matrix, counter permission assignment, wait-estimate permissions, owner/supervisor overlaps, session switching, revocation and account recovery. |
| BLOCKER | O07 | B27 settles fallback limits and supervisor ownership. Finish ledger fields, cutover/overlap procedure, verified-payment evidence, import permissions, reconciliation deadline and resumption checks. |
| BLOCKER | O08 | B31 settles timezone/day boundary and collection/refund displays. Define revenue terminology, best-seller rules and treatment of canceled/refunded orders. Distinguish actual extra payments from duplicate notifications: extra money is traceable, not another sale. |
| BLOCKER | O09 | What are operational failure thresholds, notification fallback and staff escalation paths? |
| BLOCKER | O10 | What security/privacy/retention/provider obligations apply to the business in Indonesia? |
| HIGH | O11 | Design and validate recovery for B31's one-hour target and no permanent loss of paid-order details. Define other-record RPOs, timing boundaries, PostgreSQL backups and alert ownership; hosting remains unselected and Sheets optional. |
| HIGH | O12 | Device/browser/network requirements, expected peak throughput and latency targets. |
| BLOCKER | O13 | Secure guest order lookup/recovery, receipts and customer contact method; no customer account required. B30 pickup codes do not by themselves settle lookup authorization. |
| BLOCKER | O14 | B26/B30 settle reassignment, no automatic expiry and absent-customer return. Define shift handoff, collection/completion checks, contact attempts, unattended orders and redelivery/refund resolution. |
| BLOCKER | O15 | B29 defers substitutions/partial fulfillment and settles post-payment supervisor resolution. Define stock-out during pending payment, order-edit limits and replacement-order linkage. |
| LATER | O16 | Advanced inventory scope and accounting depth after MVP stabilization. |

## Decision process

For each open issue record: decision, approver, date, reason, affected workflow/tests, and superseded decision (if any). A Codex agent must ask rather than fill in a BLOCKER with assumptions. Payment-provider selection is deferred during design, **not optional for real-money pilot or launch**.

B32 permits the demo payment path while O01 remains open. It does not waive other affected-module requirements, nor permit simulated payments/data to be promoted into production financial records.
