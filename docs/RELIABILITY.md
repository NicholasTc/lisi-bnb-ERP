# LISI BNB ERP — Reliability and Recovery Requirements

**Updated:** 2026-10-16. Current baseline: [MVP v2 decision](decisions/004-court-first-manual-qris.md). Requirements and proposed safeguards are not evidence of working v2 behavior. Merchant-verification implementation remains explicitly blocked pending operational review.

## 1. Invariants

- Court preparation may start unpaid. Ordinary handover/completion requires payment verified against trusted official merchant records and actual handover. Only supervisors/owners authorize recorded unpaid handover exceptions; exceptions stay unpaid and never count as collected revenue.
- Customer screenshots, redirects and assertions are not payment evidence. No assumption about merchant record access, identifiers/amount/time fields or immediate confirmation. Do not implement payment verification until these capabilities and staff procedures are confirmed.
- Payment/fulfillment/refund/exception status are separate. Keep integer-IDR snapshots, auditable original history and attribution; never silently rewrite a financial error.
- Committed orders remain durable and recoverable independently of browser/device state, including unpaid work in progress. Unique submission/action identities and transactional writes prevent retries from duplicating orders or funds.
- Exactly one current assignee per preparation/delivery task. Only supervisors/owners release/reassign after checking physical progress; no automatic claim expiry and no former-assignee actions.
- Customer cancellation is allowed only before preparation claim. Claim/cancel races have one permitted committed outcome; post-preparation cancellation, unpaid handover and external full refunds require supervisor/owner authorization and reason.
- Menus/pauses do not silently change order snapshots or hide existing work. An unavailable item cannot be newly checked out; subsequent fulfillment problems require explicit exception handling.
- Simulated evidence is labelled/isolated and never establishes real payment, refunds or sales. No production fallback to demo. No history deletion API.
- One merchant payment must not be reused for multiple paid orders; specific matching/reuse prevention must be designed from actual merchant evidence. Unknown external refund outcomes require reconciliation before retry; no duplicate/excess refunds or false success.
- Canceled or manually fulfilled orders must not re-enter preparation because a payment is recorded later. Preserve late/extra funds for authorized review without repeated fulfillment.

## 2. Failure outcomes

- **Lost response after checkout/action:** show uncertainty, recover authoritative state and retry the same operation. Never claim success before commit or create a new order merely because the first response was lost.
- **Missed notification/muted device:** database-backed queues remain visible; polling/manual refresh recovers work, with a stale/offline indicator. Sound is supplementary. Queue-delay/escalation thresholds remain OPEN.
- **Two employees act together:** atomic claims/transitions and current role/assignee checks reject conflicting actions. Log the winning transition; recover shift ownership through supervised physical checks.
- **Fake/abandoned court order:** required name/confirmed court and existing contact help operations but do not authenticate a customer. Keep abuse protections; suspicious-order review, quantity limits and aging rules remain OPEN. Never automatically discard prepared work or mark it paid.
- **Payment refused/failed, customer absent or wrong court:** record reason and escalate. Retain contact/return-to-café direction for absent customers; contact attempts, correction limits and final drink disposition remain OPEN. Prepared unpaid drinks remain loss/exception records, not sales or invented inventory valuations.
- **Merchant confirmation missing/delayed/inaccessible:** no guessed paid status or ordinary completed handover. Verify actual merchant capabilities and approve the waiting/escalation procedure before implementation; unpaid exceptions do not replace that review gate.
- **Same-value payments/reused receipt/erroneous confirmation:** require approved transaction-to-order matching and auditable corrections/reconciliation. The application can enforce entered-record consistency; without integration it cannot independently prove that an employee actually checked official records.
- **Extra/late/mismatched actual payment:** retain evidence, separate funds from fulfillment, and route to supervisor/owner resolution. Extra funds never imply a second order. Exact manual matching/refund evidence remains OPEN.
- **Refund performed externally with uncertain result:** distinguish approval/request from confirmed execution; reconcile before another refund. Keep payment/refund linkage and history. Automated refunds and partial refunds are deferred.
- **Application/network/database failure:** stop unsafe writes, preserve uncertainty and reconcile recorded work/payment with physical progress before resumption. No in-memory queue or browser draft is the durable source of truth.
- **Report differs from merchant:** show the discrepancy for investigation; do not overwrite history. Define reconciliation ownership/frequency and report formulas before implementation.

## 3. Data, security and technical safeguards

PostgreSQL remains authoritative. Use reviewed version-controlled migrations, constraints, explicit multi-step transactions, exact financial arithmetic, server-side input/permission checks and idempotent commands. V1 paid-before-preparation triggers must be revised through new migrations, not bypassed or removed without replacement. Retain existing test/demo records with their provenance.

Use individual accounts, multiple explicit roles and the established session expiry/revocation rules. Finish verifier/task/pause/account-management permissions before those operations. Protect secrets/contact details and avoid raw request/payment-credential logging. Merchant access must follow actual authorized staff/device arrangements, not assumed shared credentials. Privacy/retention, production owner provisioning, MFA/recovery and trusted proxy/throttle configuration remain launch questions.

UI must remain usable with failed connections and during busy service: clear next actions, readable status, duplicate-action protection, stale indicators and truthful pending results. A bright app-style design cannot hide payment uncertainty or make an exception look like a paid sale.

## 4. Outage and restoration

Retain B27: supervisor-numbered manual log plus existing merchant tools; new outage orders require official payment verification. If that verification is unavailable, stop new outage orders and continue already verified work until a different outage procedure is explicitly approved. Normal online unpaid court preparation does not silently change the outage policy.

Define cutover authority, paper/device log fields and numbering, staff ownership, physical/online overlap matching, import permissions, reconciliation deadlines and safe resumption. Imports must not duplicate revenue or re-prepare/handover work already performed. No automatic replay of physical tasks on recovery.

**B31 target remains:** restore digital service within one hour with no permanent loss of paid-order details. This is a business objective, not validated architecture. Define timing boundaries, backup/restore ownership and other-record RPOs, including unpaid work in progress. Test backups/restoration with items, quantities, exact prices, court, assignees and financial/physical events after the backup point. Merchant references alone cannot rebuild complete orders. Google Sheets remains an optional read-only reporting mirror, not an operational database or backup substitute.

## 5. Release evidence and historical tests

Before a separately approved court pilot: test browser closure, repeat submission, simultaneous claims/cancel, assignee revocation, offline updates, missed alerts, wrong/absent customer, refusal, pauses, merchant-unavailable procedure, financial correction/external refund, manual overlap and backup restore. Set measurable staleness/latency/capacity/reconciliation/refund-resolution thresholds and train named incident owners. See `ACCEPTANCE.md`.

Actual merchant operational review and controlled real-money verification with owner approval are required; gateway sandbox/webhook integration is not an MVP gate. Labelled fixtures can test independent operations but cannot validate manual verification or establish fully tested court acceptance while the merchant block remains.

The existing Milestone 3 signed demo inbox, financial transitions and crash-reconciliation tests remain historical evidence in `VERIFICATION-M3.md`. They prove no real merchant capabilities and do not validate the v2 workflow or B31 recovery targets. No new tests have been executed for this requirements-only update.
