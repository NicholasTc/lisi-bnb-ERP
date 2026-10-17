# LISI BNB ERP — Decision Register

**Status:** Living register. Use this document to resolve ambiguity; do not interpret proposals as approvals.  
**Updated:** 2026-10-16

## Status meanings

- **CONFIRMED:** Explicitly selected by the user.
- **PROPOSED:** Recommended, but not approved.
- **OPEN:** Needs a decision, evidence or business input.
- **SUPERSEDED:** Replaced by a later explicit decision.

## Current precedence — MVP v2

B35–B39 and [the court-first/manual QRIS decision](decisions/004-court-first-manual-qris.md) supersede conflicting v1 payment/release rules. Phase 1 is customer court ordering; Phase 2 is counter/pickup/dine-in, with detailed rules deferred. V2-1 now adds local court checkout under B40; historical Milestone 3 demo data/services remain isolated. Payment-verification implementation is expressly blocked pending merchant review.

## Confirmed business decisions

| ID | Status | Decision |
|---|---|---|
| B01 | CONFIRMED | One café and kitchen serving multiple padel/tennis buildings. |
| B02 | CONFIRMED, PHASED | Court delivery is Phase 1. Counter/pickup/dine-in are deferred to Phase 2 under B36; their detailed rules are not settled for v2. |
| B03 | CONFIRMED, DEFERRED | Café counter QR self-ordering/employee-entered ordering remains a later direction; build and test court ordering first under B36. |
| B04 | CONFIRMED | Court-specific QR preselects court; customer can override. |
| B05 | CONFIRMED | Guest checkout; no customer account required. |
| B06 | SUPERSEDED FOR COURTS | V1 required payment before preparation. B35 permits unpaid Phase 1 court preparation and requires official merchant payment verification before ordinary handover/completion. Phase 2 timing is deferred. |
| B07 | CONFIRMED | Preparation and delivery are separate roles, with potentially multiple employees per role. |
| B08 | CONFIRMED | Shared queues; employees claim their own preparation/delivery tasks. |
| B09 | CONFIRMED | Ready court orders go to delivery queue; pickup/dine-in use ready/handoff flow. |
| B10 | CONFIRMED | Staff can pause services and adjust wait estimates. |
| B11 | CONFIRMED, EXTENDED | Supervisor/owner authorizes paid cancellation/refunds; B37 adds unpaid handover and post-preparation cancellation authority and restricts guest cancellation to before preparation claim. |
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
| B23 | SUPERSEDED IN PART | QRIS-only remains; cash/EDC deferred. B35 replaces automatic verification/gateway dependency with trusted official merchant-record checks by authorized employees. The checking procedure is not yet known or implemented. |
| B24 | CONFIRMED | Late payments for canceled/expired orders require supervisor review, with refund as the default rather than automatic preparation. Refund the extra verified payment on duplicate payment; never duplicate fulfillment. |
| B25 | CONFIRMED | Unpaid orders may be canceled. Paid cancellations/refunds require supervisor/owner approval; full cancellation is normally allowed before preparation, and exceptions after preparation starts require individual review. Partial refunds are deferred. Uncertain refund results remain pending reconciliation before retry. |
| B26 | CONFIRMED | Only supervisors/owners release or reassign claimed work, after checking physical progress. No automatic claim expiry; reject subsequent actions from the previous assignee. |
| B27 | CONFIRMED | During outages, accept new manual orders only with official merchant payment verification; otherwise stop new orders and continue already verified work. A designated supervisor numbers manual records, resolves overlap and approves return to online operation. |
| B28 | CONFIRMED | Designated counter staff enter orders; preparation staff control availability and kitchen pauses; supervisors manage service pauses, reassignment and destination corrections; owners control prices, accounts and financial reporting. Supervisor/owner refund authority remains. Use individual accounts on shared devices and server-side authorization. |
| B29 | CONFIRMED | Recheck availability at checkout and freeze agreed prices. If fulfillment becomes impossible after payment, a supervisor resolves it through a full refund and replacement-order offer. Substitutions and partial fulfillment are deferred. |
| B30 | CONFIRMED | Order-specific pickup codes, numbered dine-in tables and explicit building/court confirmation. For absent court customers, record failed delivery, attempt the agreed contact method and return to the café; do not automatically mark delivered. |
| B31 | CONFIRMED | Reporting uses Asia/Jakarta midnight-to-midnight, showing verified payments received, confirmed refunds issued and their difference separately from settlement. Count unique paid orders, not duplicate payments. Recovery target: digital service within one hour, with no permanent loss of paid-order details; feasibility must be demonstrated in drills. |
| B32 | SUPERSEDED IN PART | Existing non-production demo evidence/data remain labelled and isolated from real records; simulation is forbidden as production payment evidence. B35 removes mandatory gateway integration from this MVP; merchant operational proof is still mandatory before real-money acceptance. |
| B33 | CONFIRMED | Milestone 2 uses one fixed final-inclusive integer-IDR price per item; variants/modifiers are deferred. Owner-only building/court/numbered-table management starts empty. Customer UI offers Bahasa Indonesia and English; actual menu/location content comes from the owner. |
| B34 | HISTORICAL V1 APPROVAL | Milestone 3 demo implementation approval remains recorded in `decisions/003-ordering-proposal.md`. B35–B39 supersede conflicting court payment-first, expiry/cancellation and phase assumptions; unchanged exact-price/private-access/security requirements remain. |
| B35 | CONFIRMED | MVP v2 uses existing official merchant QRIS with employee verification at court delivery; unpaid court preparation is allowed. Trusted official merchant evidence is required before paid status/ordinary handover. No gateway, webhooks or automated refunds in this MVP. |
| B36 | CONFIRMED | Two main development phases: build/test customer court ordering first; counter, pickup and dine-in follow in Phase 2 with detailed rules decided then. Owner explicitly clarified the earlier ambiguous “yes.” |
| B37 | CONFIRMED | Only supervisors/owners approve unpaid handover, cancellations after preparation and externally performed full refunds, with audit reasons. Unpaid exceptions are separate from paid sales; customers may cancel only before preparation is claimed. |
| B38 | CONFIRMED | Bright, professional, intuitive mobile-first app-style UI, DoorDash-inspired ordering simplicity and original branding; avoid dense dashboard/test-control presentation in normal ordering and task flows. |
| B39 | CONFIRMED BLOCK | Merchant staff access, stable transaction reference/amount/time availability and immediate confirmation are OPEN. Do not implement payment verification until official merchant capabilities and the staff procedure are confirmed. Requirements/independent development do not pass real payment/handover acceptance. |
| B40 | CONFIRMED | V2-1 implementation approved on 2026-10-16: submitted court orders are immediately eligible for unpaid preparation; no automatic cancellation; older/suspicious orders remain for staff review/escalation. Pre-claim customer cancellation and 24-hour private access remain. Exact local implementation/boundaries: `decisions/005-court-ordering.md`. V2-2 and payment verification remain separate gates. |

### Approval record — B35–B39 / MVP v2 (2026-10-16)

Owner supplied the revised court/pay-at-delivery/manual-QRIS requirements, expressly required unknown merchant capabilities to stay OPEN and blocked payment-verification implementation. Owner approved the exception/cancellation defaults and UI direction, then clarified customer court ordering only first, with counter/pickup/dine-in deferred. This records the new requirements and staged plan; it is not authorization to implement blocked payment verification, deploy or use real customer funds. Original approvals below are history, subject to this supersession.

### Approval record — B33 / Milestone 2

Product owner approved Milestone 2 menu/location implementation and explicitly confirmed pricing, directory permissions/empty start and both customer languages on 2026-10-14. See `decisions/002-catalog.md` for implementation choices and module acceptance. This settles O04/O05/O06 only for this module; ordering, payments, operational permissions and launch remain separate approvals.

### Approval record — B34 / Milestone 3

Product owner instructed proceeding on 2026-10-15 after the seven defaults, detailed state proposal and simple milestone outcome were presented. Approval covers the non-production ordering/demo module only. Merchant integration, post-preparation exceptions, physical handoff/service controls, real refunds and launch remain later decisions/gates. The proposal filename is retained to preserve existing links; its header records confirmed status.

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

## Superseded decisions

| ID | Status | Prior decision | Superseded by |
|---|---|---|---|
| S01 | SUPERSEDED | Round 4 originally selected inventory and accounting in initial release. | B22: defer advanced inventory/accounting until after operational MVP is tested. |
| S02 | SUPERSEDED | P07 proposed a mock payment provider in non-production only, with real verification before pilot. | B32 confirms demo-first development/testing and production separation. |
| S03 | SUPERSEDED FOR PHASE 1 | B06 required payment before preparation for every order. | B35 permits unpaid court preparation; trusted verification is required before ordinary handover, with B37's unpaid exception path. |
| S04 | SUPERSEDED FOR MVP V2 | B23/B32 made gateway/automatic payment verification mandatory before pilot. | B35/B39 require a proven official manual merchant procedure instead; payment verification implementation is blocked until operational review. |
| S05 | SUPERSEDED FOR PHASE 1 | B34 demo payment expiry and cancellation while any order is unpaid. | B37 limits customer cancellation to pre-claim; new court aging/deadline rules remain OPEN. |

## Current payment direction — MVP v2

Use existing official merchant QRIS and manual verification; no gateway integration, webhook or automated refund execution in this MVP. Do not assume the actual merchant product, staff access, evidence fields, confirmation speed or refund capabilities. O01/O03 and `OPEN_QUESTIONS.md` block payment-verification implementation. Customer screenshots alone are insufficient. Simulated records remain test-only and cannot establish real collections. Counter/pickup/dine-in timing will be decided in Phase 2.

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
| BLOCKER | O01 | Before payment-verification implementation: confirm existing official merchant system, authorized employee/device access, stable reference/amount/payment-time availability, success/pending meaning and confirmation speed. Approve actual checking/matching/unavailable-record procedures. No gateway assumption; no real-money acceptance until proven. |
| BLOCKER | O02 | B40 settles immediate unpaid preparation eligibility/no automatic cancellation and the minimal V2-1 state model. Approve later task/handover/payment transitions, staff aging/escalation thresholds, suspicious-order review and post-preparation exception grounds. V1 demo states/15-minute expiry do not settle these. B37 settles pre-claim guest cancellation and supervisor/owner exception authority. |
| BLOCKER | O03 | After merchant review, define verifier permissions/evidence, simultaneous equal-value matching, reuse prevention, error corrections, receipt handling and external full-refund proof/unknown results. No generic mark-paid shortcut; payment verification implementation is blocked first. Phase 2 payment timing is deferred. |
| BLOCKER | O04 | B33 approves owner-only directory management starting empty; B30 settles numbered tables, pickup codes and court confirmation. Supply real entries/QR placement, coverage and destination-correction limits by fulfillment stage before customer ordering. |
| BLOCKER | O05 | B33/B34 settle fixed inclusive prices, deferred variants, no discounts/zero-price checkout and pending-order availability checks for Milestone 3. Supply real content/prices; replacement-order handling and future promotions remain separate decisions. |
| BLOCKER | O06 | B28 settles permission direction and individual identity. Approve the complete matrix, counter permission assignment, wait-estimate permissions, owner/supervisor overlaps, session switching, revocation and account recovery. |
| BLOCKER | O07 | B27 settles fallback limits and supervisor ownership. Finish ledger fields, cutover/overlap procedure, verified-payment evidence, import permissions, reconciliation deadline and resumption checks. |
| BLOCKER | O08 | B31 retains Asia/Jakarta day boundaries and separate collection/refund/settlement displays. Define best sellers/counts, verified collection recognition, outstanding unpaid orders and prepared unpaid loss/exception reporting, canceled/refunded orders, corrections and merchant reconciliation ownership/frequency. No unpaid exception is a paid sale. |
| BLOCKER | O09 | What are operational failure thresholds, notification fallback and staff escalation paths? |
| BLOCKER | O10 | What security/privacy/retention/provider obligations apply to the business in Indonesia? |
| HIGH | O11 | Design and validate recovery for B31's one-hour target and no permanent loss of paid-order details. Define other-record RPOs, timing boundaries, PostgreSQL backups and alert ownership; hosting remains unselected and Sheets optional. |
| HIGH | O12 | Device/browser/network requirements, expected peak throughput and latency targets. |
| BLOCKER | O13 | B34 settles private 24-hour guest links and manual court phone contact in Milestone 3; pickup code/order number are not lookup credentials. Actual receipt/provider obligations, staff-assisted recovery identity checks and later delivery contact procedures remain open before their implementation/customer use. |
| BLOCKER | O14 | B26/B30/B37 settle physical-check reassignment, no claim expiry, absent-customer return, exception authority and pre-claim guest cancellation. Define shift handoff, collection/normal versus exceptional completion, contact attempts, correction limits, drink disposition and redelivery resolution. |
| BLOCKER | O15 | Recheck availability at checkout and preserve snapshots; no substitutions/partial fulfillment. Define v2 queued/preparing stock-out handling, service pause effects and replacement linkage. Do not inherit the old payment-acceptance availability timing for unpaid court preparation. |
| LATER | O16 | Advanced inventory scope and accounting depth after MVP stabilization. |

## Decision process

For each open issue record: decision, approver, date, reason, affected workflow/tests, and superseded decision (if any). A Codex agent must ask rather than fill in a BLOCKER with assumptions. MVP v2 does not require a gateway selection/integration. Confirming and proving the existing official merchant verification procedure is mandatory before payment-verification implementation and real-money acceptance.

B35–B39 permit requirements and independent court development to be planned while O01 remains open; they explicitly block implementing payment verification until merchant review. Existing demo data must never be promoted to real financial records. No fully tested court/payment or launch claim is valid while that gate is open.
