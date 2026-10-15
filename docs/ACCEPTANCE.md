# LISI BNB ERP — Acceptance Criteria and Launch Gates

**Status:** Draft verification contract. Pass/fail criteria below include confirmed business requirements and proposed safety tests; detailed thresholds and expected edge-case policies remain OPEN.  
**Updated:** 2026-10-14

B23–B31 in `DECISIONS.md` are owner-approved defaults. Criteria below are verification requirements; open mechanisms/policies still need approval. Executed foundation evidence is recorded in `VERIFICATION.md`; later MVP workflows remain unverified.

B32 approves demo-first payments in non-production while merchant selection is pending. Demo results can establish provider-independent behavior, but cannot pass real-provider or real-money pilot gates.

## 1. Test strategy

Every critical workflow requires automated tests where practical plus realistic device/staff exercises. Passing compilation or a happy-path demo is **not acceptance**. Evidence must include test results, observed outcomes, known issues and the approving person.

### Milestone 1 — Foundation gate (approved 2026-10-14)

- Reproducible installation, development startup, production build/local startup, TypeScript and lint checks succeed.
- Reviewed migrations apply to fresh isolated PostgreSQL and rerun without changes; constraints/rollback and wrong-target/marker rejection are tested.
- Vitest unit/integration and Chromium Playwright tests execute successfully; authentication is tested through actual hashed credentials and persisted sessions.
- Registration denial, current multiple roles, unauthorized access, origin protection, throttling, eight-hour non-refreshing expiry, thirty-minute idle expiry, logout and disabling/revocation pass.
- Passive checks do not extend inactivity; expired sessions cannot be revived. Disabling and session creation are tested concurrently.
- Database failure yields sanitized readiness failure and recovery; secrets/payment credentials are excluded and payments remain disabled.
- No ordering/payment/dashboard or deferred features; `AGENTS.md` remains preserved. Production provisioning remains a launch blocker in `OPEN_QUESTIONS.md`.

This module-specific gate does not require resolving later order/menu/payment workflows. The following MVP gates still apply before their affected modules or real-money use.

### Milestone 2 — Menu/location gate (approved 2026-10-14)

- Customers browse in Bahasa Indonesia/English without login; search/categories, inclusive IDR prices, unavailable labels and truthful loading/empty/network-error states work on mobile/desktop.
- Owners create/edit/archive menu items and manage buildings/courts/numbered tables; preparation staff can change only availability. Anonymous, delivery/supervisor, forged-field and cross-origin edits are rejected server-side.
- Prices reject fractions/negative values; names, numbered tables, parent relationships and scoped duplicate locations are validated, including database constraints.
- Concurrent stale edits return conflict; retrying creation with the same operation ID cannot duplicate records. Every committed edit has actor/before/after history; an audit failure rolls back the edit.
- Stable court-ID links preselect an active court in an active building, require explicit confirmation and allow override. Unknown/inactive/table IDs require correction; no order is created by selection.
- Additive migrations apply to isolated PostgreSQL and rerun safely; foundation regression checks pass. No real menu/location content is fabricated, no orders/payments/operational queues added.

Executed evidence belongs in `VERIFICATION-M2.md`; passing this gate does not approve Milestone 3 or production use.

### Gate A — Requirements readiness (before implementation of affected module)
- [ ] Confirmed vs proposed vs open rules are explicitly recorded in `DECISIONS.md`.
- [ ] Demo work may proceed with O01 open under B32, once its affected business rules are approved. Official capabilities and confirmation mechanism must be validated before implementing/testing the real-provider integration; demo success is not that evidence.
- [ ] Order/payment state diagrams and authorized transitions approved.
- [ ] Role/permission matrix, location directory, menu/price rules and exception policies approved.
- [ ] No unresolved BLOCKER is silently implemented by assumption.

### Gate B — Functional acceptance (staging)

| ID | Scenario | Pass criterion |
|---|---|---|
| F01 | Scan court QR | Correct court preselected; customer can change it; final choice stored. |
| F02 | Guest checkout | Order placed without creating customer account. |
| F03 | Counter entry | Designated counter employee can create a QRIS order with individually traceable creator/service type; others cannot. |
| F04 | Three service modes | Court delivery, pickup and dine-in take correct handoff paths. |
| F05 | Payment pending/failed | Order never enters preparation queue without trusted verified payment. |
| F06 | Verified payment | Eligible order appears **once** in shared preparation without manual approval; canceled/expired or already manually fulfilled orders do not auto-enter. |
| F07 | Kitchen claim | Exactly one of two simultaneous claims succeeds. |
| F08 | Ready court order | Appears in shared delivery queue with correct building/court. |
| F09 | Delivery claim/complete | Authorized delivery staff can claim and complete; audit history retained. |
| F10 | Pickup/dine-in | Ready pickup order uses its order-specific code; wrong-order code is rejected and completion cannot repeat. Dine-in stores a valid numbered table and uses handoff without court delivery. Detailed checks/code lifecycle remain OPEN. |
| F11 | Product availability | Authorized preparation staff/owner can toggle; unavailable product cannot be newly ordered under approved rules. |
| F12 | Service pause | Authorized staff can pause selected service(s), adjust wait estimates, and existing paid orders remain accessible. |
| F13 | Staff permissions | Each role is denied unauthorized server-side actions, even via direct API requests. |
| F14 | Refund/cancellation | Unpaid cancellation is supported; only supervisor/owner approves paid cancellation/refund. Full cancellation normally allowed before preparation; later exceptions require recorded individual review under approved grounds. Partial refunds are deferred; original history, reason and financial impact retained. |
| F15 | Notifications | New orders update live queue with visual and audible cues; queue remains usable if sound unavailable. |
| F16 | Owner dashboard | Asia/Jakarta midnight boundaries apply. Verified payments received, confirmed refunds issued and their difference agree with independent test totals and are separate from settlement. Unique paid-order count excludes duplicate payments. Remaining revenue/count/best-seller policies need approval. |
| F17 | Responsive devices | Ordering and employee flows work on target smartphones and café device. |
| F18 | MVP tenders | Customer/counter checkout offers QRIS only, with trusted automatic verification; cash/EDC and unrestricted manual-paid overrides are unavailable. Provider capability verified before pilot. |
| F19 | Absent court customer | Failed delivery recorded, agreed contact method attempted and return-to-café recorded; order is not automatically completed. Test contact/return procedure once approved. |
| F20 | Privileged actions and attribution | Approved B28 permissions enforced server-side; denied roles cannot change prices/accounts, pause services, reassign or correct destinations. Shared-device actions identify the individual employee. Full matrix/session behavior approved before execution. |
| F21 | Demo checkout | Non-production order/payment screens and history clearly show simulated payments; payment display is non-payable. Simulated outcomes reach server-side shared order rules without creating actual charges or production records. |

### Gate C — Reliability and security

| ID | Scenario | Pass criterion |
|---|---|---|
| R01 | Repeated payment callback | No duplicate paid order, kitchen entry or revenue. |
| R02 | Lost/delayed callback | Payment remains unverified until trusted evidence; reconciliation recovers verified payment and releases only eligible work, without duplicate fulfillment. |
| R03 | Browser closes after payment | Order remains persisted and recoverable. |
| R04 | Double checkout submission | No accidental duplicate charge/order from retried action. |
| R05 | Two staff update same order | Conflicting transition rejected or safely resolved; no silent overwrite. |
| R06 | Network interruption | Staff sees uncertainty/offline status and can safely retry without duplicate transition. |
| R07 | Invalid role / unauthenticated action | Server rejects unauthorized access and financial operations. |
| R08 | Price changes after checkout/sale | Frozen agreed prices and historical totals remain unchanged despite later menu edits; availability revalidated at checkout. Pending-payment stock-out outcome follows policy once approved. |
| R09 | Refund/cancel history | Original transaction preserved; actor, reason and linked refund traceable. |
| R10 | Secret handling | No live keys in client bundle, repository, screenshots or logs. |
| R11 | Backup restore | Drill demonstrates safe digital recovery within one hour and no permanent loss of paid-order details, including items, quantities, amounts, destination and recorded work/financial events after the backup point. Resumption does not repeat fulfillment/refunds. Clock boundaries and other-record RPO approved before drill. |
| R12 | Reporting reconciliation | Differences against merchant records are visible, not silently ignored. |
| R13 | Manual outage and return | No new orders without official merchant verification; already verified work can continue. Designated supervisor numbers manual records, resolves overlap and approves online return. Test local outage with server still online and manually fulfilled order receiving late verification; no double-counting/release. |
| R14 | Mock payments and fail-closed configuration | Production rejects demo configuration/controls and simulated payment evidence, including direct requests. Missing/invalid real-provider configuration leaves payments unavailable rather than enabling demo. Test records are absent from production financial reports. |
| R15 | Late payment | Verified payment after cancellation/expiry remains traceable, routes to supervisor review with refund default and does not automatically restart preparation. |
| R16 | Actual duplicate payment | Two distinct verified payments for one order produce one fulfillment/order count; extra payment is traceable and refunded with supervisor/owner authorization. Distinguish extra funds from a repeated notification. |
| R17 | Refund timeout/concurrency | Simulate success with lost response and simultaneous refund requests. Unknown outcome stays pending until reconciled; no second refund or refund beyond verified refundable funds. Confirmed outcomes/evidence preserved. |
| R18 | Reassignment/stale actor | Supervisor/owner records physical-progress check before release/reassignment; ordinary employee denied, no automatic expiry, previous-assignee transitions rejected. Device retry cannot duplicate work. |
| R19 | Post-payment unavailability | Supervisor can resolve through full refund and replacement-order offer; original payment/order history retained. Substitution/partial fulfillment unavailable; replacement is not automatically created or charged. |
| R20 | Verification and interrupted processing | Invalid authentication, amount/currency/order/transaction mismatch and invalid regressions never release work. Repeated/out-of-order events and crashes between payment persistence and queue visibility recover eligible paid work once. Use documented provider cases and independent assertions. |
| R21 | Demo failure coverage | Demo can exercise pending/success/failure/expiry, delayed/missing/repeated/out-of-order events, mismatched amount/identity, duplicate payments and uncertain refund outcomes. Approved business outcomes, idempotency and server-side permissions are asserted; no actual funds move. |
| R22 | Replaceable provider integration | A shared provider-independent suite exercises demo and the selected real adapter through the same business-rule boundary. Real-adapter tests use official authentication/capability evidence and provider sandbox/controlled live cases where permitted. Swapping integration does not require rewriting core order logic; provider-specific gaps remain visible until resolved. |

### Gate D — Limited real-order pilot
- [ ] All critical staging scenarios pass, including failure and recovery tests.
- [ ] Payment provider, merchant account, production credentials and verified payment notifications work in controlled live transactions.
- [ ] Real-adapter payment/reconciliation/refund tests pass; simulated payments and demo data cannot be used as pilot acceptance evidence or production transaction records.
- [ ] Pilot boundaries, staff, schedule, traffic/volume limits, rollback trigger and incident owner documented.
- [ ] Preparation and delivery employees trained on claim, handoff, wrong location, pause, failed payment and manual fallback.
- [ ] Owner/supervisor trained on cancellations, refunds, discrepancies and reporting.
- [ ] Monitoring, backup restore, manual runbook and reconciliation procedures exercised.
- [ ] Pilot recovery drill demonstrates B31's one-hour digital recovery target and no permanent loss of paid-order details; timing boundaries, other-record RPO and recovery ownership approved. No assumption that merchant references alone reconstruct orders.
- [ ] Real paid pilot orders reconcile to merchant transaction records and order history.
- [ ] No unresolved critical payment, authorization, lost-order or double-fulfillment defects.

### Gate E — Full public launch
- [ ] Pilot results reviewed; critical incidents resolved and fixes retested.
- [ ] Load/concurrency tests pass agreed peak volume and response-time targets (**targets OPEN**).
- [ ] B31 recovery targets revalidated for launch conditions; other-record RPO, alert ownership, incident escalation and support coverage approved (**remaining details OPEN**).
- [ ] Recovery and rollback procedures tested; staff trained and available.
- [ ] Privacy, security and payment-provider requirements reviewed for actual operating jurisdiction.
- [ ] Owner explicitly approves launch based on documented evidence.

## 2. Test data and reconciliation requirements

For financial assertions, verify amounts from item-price snapshots, quantities, discounts, taxes/fees if applicable, verified payment references, refunds and the agreed reporting timezone/business-day boundary. Define expected totals independently of the implementation. Do not use the same calculation as both system-under-test and test oracle.

For concurrency, test simultaneous employee claims and repeated payment notifications, not merely sequential clicks. For outages, test recovery with an unfinished paid order and an overlapping manual order to prove reconciliation works.

For reporting, include payments/refunds across Asia/Jakarta midnight, actual extra payments, repeated notifications and overlapping manual records. Extra received funds remain traceable but do not create another sale/order. Remaining revenue, canceled/refunded-order count and best-seller rules require an independent approved oracle.

For refunds and recovery, inject failures after external success but before local confirmation, and restore a backup predating known fulfillment/refunds. Compare complete records and physical-work evidence before resuming; financial references alone are insufficient.

## 3. Explicitly not accepted as evidence

- “The UI shows Paid” without merchant-backed verification.
- A customer-submitted payment screenshot.
- A happy-path demo without failure cases.
- Successful compilation or passing unit tests alone.
- An untested backup, an unmonitored background job or an unreviewed manual workaround.
- An assumed payment provider integration or a promise that no failures can occur.

## 4. Open numeric thresholds and operational criteria

**Approved B31 target:** Digital recovery within one hour, with no permanent loss of paid-order details. Feasibility remains unverified. Timing boundaries and RPO for other records must be defined before pilot recovery testing.

Before pilot/full launch, approve maximum order-to-kitchen delay, notification staleness threshold, peak orders per minute, acceptable availability, reconciliation frequency/deadline, backup frequency, refund resolution time and incident-response ownership. These remaining values are **OPEN**.

## 5. Post-MVP features

Advanced inventory and accounting are **not** prerequisites for the operational MVP or pilot. They require separate requirements, tests, migrations and acceptance gates after MVP stabilization. MVP must still retain correct historical product, order, payment, refund and audit records to support future expansion.
