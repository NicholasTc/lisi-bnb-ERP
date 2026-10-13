# LISI BNB ERP — Acceptance Criteria and Launch Gates

**Status:** Draft verification contract. Pass/fail criteria below include confirmed business requirements and proposed safety tests; detailed thresholds and expected edge-case policies remain OPEN.  
**Updated:** 2026-10-13

## 1. Test strategy

Every critical workflow requires automated tests where practical plus realistic device/staff exercises. Passing compilation or a happy-path demo is **not acceptance**. Evidence must include test results, observed outcomes, known issues and the approving person.

### Gate A — Requirements readiness (before implementation of affected module)
- [ ] Confirmed vs proposed vs open rules are explicitly recorded in `DECISIONS.md`.
- [ ] Payment provider capabilities and official confirmation mechanism validated before real-money testing.
- [ ] Order/payment state diagrams and authorized transitions approved.
- [ ] Role/permission matrix, location directory, menu/price rules and exception policies approved.
- [ ] No unresolved BLOCKER is silently implemented by assumption.

### Gate B — Functional acceptance (staging)

| ID | Scenario | Pass criterion |
|---|---|---|
| F01 | Scan court QR | Correct court preselected; customer can change it; final choice stored. |
| F02 | Guest checkout | Order placed without creating customer account. |
| F03 | Counter entry | Authorized employee can create an order with traceable creator and service type. |
| F04 | Three service modes | Court delivery, pickup and dine-in take correct handoff paths. |
| F05 | Payment pending/failed | Order never enters preparation queue without trusted verified payment. |
| F06 | Verified payment | Order appears **once** in shared preparation queue without manual approval. |
| F07 | Kitchen claim | Exactly one of two simultaneous claims succeeds. |
| F08 | Ready court order | Appears in shared delivery queue with correct building/court. |
| F09 | Delivery claim/complete | Authorized delivery staff can claim and complete; audit history retained. |
| F10 | Pickup/dine-in | Ready order can be handed off and completed without court-delivery step. |
| F11 | Product availability | Authorized preparation staff/owner can toggle; unavailable product cannot be newly ordered under approved rules. |
| F12 | Service pause | Authorized staff can pause selected service(s), adjust wait estimates, and existing paid orders remain accessible. |
| F13 | Staff permissions | Each role is denied unauthorized server-side actions, even via direct API requests. |
| F14 | Refund/cancellation | Only supervisor/owner can authorize; reason and financial impact recorded under approved rules. |
| F15 | Notifications | New orders update live queue with visual and audible cues; queue remains usable if sound unavailable. |
| F16 | Owner dashboard | Today's revenue, count, best sellers and history agree with authoritative test transactions. |
| F17 | Responsive devices | Ordering and employee flows work on target smartphones and café device. |

### Gate C — Reliability and security

| ID | Scenario | Pass criterion |
|---|---|---|
| R01 | Repeated payment callback | No duplicate paid order, kitchen entry or revenue. |
| R02 | Lost/delayed callback | Payment remains pending until verified; reconciliation can recover verified payment. |
| R03 | Browser closes after payment | Order remains persisted and recoverable. |
| R04 | Double checkout submission | No accidental duplicate charge/order from retried action. |
| R05 | Two staff update same order | Conflicting transition rejected or safely resolved; no silent overwrite. |
| R06 | Network interruption | Staff sees uncertainty/offline status and can safely retry without duplicate transition. |
| R07 | Invalid role / unauthenticated action | Server rejects unauthorized access and financial operations. |
| R08 | Price changes after sale | Historical sold price and totals remain unchanged. |
| R09 | Refund/cancel history | Original transaction preserved; actor, reason and linked refund traceable. |
| R10 | Secret handling | No live keys in client bundle, repository, screenshots or logs. |
| R11 | Backup restore | A documented restore drill succeeds; restored data is checked against known transactions. |
| R12 | Reporting reconciliation | Differences against merchant records are visible, not silently ignored. |
| R13 | Manual outage and return | Staff can record, fulfill and reconcile manual orders without double-counting. |
| R14 | Mock payments | Test/mock payment mechanisms cannot be invoked in production. |

### Gate D — Limited real-order pilot
- [ ] All critical staging scenarios pass, including failure and recovery tests.
- [ ] Payment provider, merchant account, production credentials and verified payment notifications work in controlled live transactions.
- [ ] Pilot boundaries, staff, schedule, traffic/volume limits, rollback trigger and incident owner documented.
- [ ] Preparation and delivery employees trained on claim, handoff, wrong location, pause, failed payment and manual fallback.
- [ ] Owner/supervisor trained on cancellations, refunds, discrepancies and reporting.
- [ ] Monitoring, backup restore, manual runbook and reconciliation procedures exercised.
- [ ] Real paid pilot orders reconcile to merchant transaction records and order history.
- [ ] No unresolved critical payment, authorization, lost-order or double-fulfillment defects.

### Gate E — Full public launch
- [ ] Pilot results reviewed; critical incidents resolved and fixes retested.
- [ ] Load/concurrency tests pass agreed peak volume and response-time targets (**targets OPEN**).
- [ ] RPO/RTO, alert ownership, incident escalation and support coverage approved (**targets OPEN**).
- [ ] Recovery and rollback procedures tested; staff trained and available.
- [ ] Privacy, security and payment-provider requirements reviewed for actual operating jurisdiction.
- [ ] Owner explicitly approves launch based on documented evidence.

## 2. Test data and reconciliation requirements

For financial assertions, verify amounts from item-price snapshots, quantities, discounts, taxes/fees if applicable, verified payment references, refunds and the agreed reporting timezone/business-day boundary. Define expected totals independently of the implementation. Do not use the same calculation as both system-under-test and test oracle.

For concurrency, test simultaneous employee claims and repeated payment notifications, not merely sequential clicks. For outages, test recovery with an unfinished paid order and an overlapping manual order to prove reconciliation works.

## 3. Explicitly not accepted as evidence

- “The UI shows Paid” without merchant-backed verification.
- A customer-submitted payment screenshot.
- A happy-path demo without failure cases.
- Successful compilation or passing unit tests alone.
- An untested backup, an unmonitored background job or an unreviewed manual workaround.
- An assumed payment provider integration or a promise that no failures can occur.

## 4. Open numeric thresholds and operational criteria

Before pilot/full launch, approve target maximum order-to-kitchen delay, notification staleness threshold, expected peak orders per minute, acceptable availability, reconciliation frequency, backup frequency, RPO, RTO, refund resolution time and staff incident-response ownership. These values have **not** been decided in the design sprint.

## 5. Post-MVP features

Advanced inventory and accounting are **not** prerequisites for the operational MVP or pilot. They require separate requirements, tests, migrations and acceptance gates after MVP stabilization. MVP must still retain correct historical product, order, payment, refund and audit records to support future expansion.
