# LISI BNB ERP — Workflows

**Updated:** 2026-10-17. Current requirements: [MVP v2 decision](decisions/004-court-first-manual-qris.md). These workflows are requirements, not implemented/verified behavior. V1 demo behavior remains documented in `decisions/003-ordering-proposal.md` and `VERIFICATION-M3.md`.

## 1. Court ordering — Phase 1

1. Customer opens the court QR link; validate and preselect the building/court, allow correction and require confirmation.
2. Customer browses in Bahasa Indonesia/English, chooses available drinks, reviews quantities/final inclusive total and enters name/court phone contact as previously required.
3. Server checks authoritative prices, availability and destination. A price change requires review; a successful commit freezes the agreed snapshots.
4. Only after commit, show a unique reference and clear order confirmation with “pay at delivery” messaging. Preserve safe retry after a lost response; never claim success without confirmation.
5. Customer can reopen the private 24-hour status link. Order/reference number alone does not grant access. Losing the browser does not delete or stop a committed order.
6. Customer may cancel only before preparation is claimed. Serialize claim/cancel conflicts. No automatic cancellation is approved; staff aging/escalation thresholds remain OPEN; do not copy the 15-minute v1 demo payment deadline into this workflow.

## 2. Preparation and delivery

1. An eligible submitted court order appears once in the durable preparation queue while unpaid. Preparation staff/owners may hold unclaimed or their own claimed work with a required review reason; resolution follows [decision 007](decisions/007-delivery-and-team.md).
2. A preparation employee claims the task; exactly one employee owns it. Only its current authorized assignee prepares and marks it ready. Owners may work preparation; supervisors are view-only unless also preparation. See [implemented preparation rules](decisions/006-preparation.md).
3. Ready court orders appear in the shared delivery queue. A delivery-role employee or owner exclusively claims, records actual collection/on-the-way, then arrival awaiting payment/handover. Only the current assignee progresses it. The eventual live process brings the official merchant QRIS; payment remains gated during local testing.
4. Customer pays at delivery. Before marking paid or ordinary handover, an authorized employee checks successful payment in trusted official merchant records.
5. Record verified payment and actual handover with employee attribution/timestamps; normal completion requires both. V2-3 delivery/recovery transitions are approved in decision 007; verifier permissions/evidence remain blocked.

**Step 4 and its payment-verification workflow must not be implemented until the merchant operational review is complete.** Access, identifiers/amount/time fields and confirmation speed are unknown. No customer screenshot, employee assumption or generic mark-paid button substitutes for trusted records.

**Required concurrency/recovery:** atomic claims, server-side role/assignee checks, idempotent updates, polling plus manual refresh, stale/offline feedback and retained audit. Only supervisors/owners release/reassign after checking physical progress; no automatic claim expiry. Previous assignees cannot continue acting after reassignment.

## 3. Exceptions, cancellation and refunds

- Customer cancellation ends at preparation claim, even if unpaid. Only supervisors/owners authorize cancellation after preparation, unpaid handover and external full refunds; actor/reason required.
- Refused/failed payment or an absent customer becomes an employee-visible exception and is escalated. For absent customers retain the existing direction: attempt contact, record failed delivery and return to café; a contact attempt/outcome is required for absent/refused incidents, and collected drinks must return before cancellation. Owners/supervisors may retry after physical review, returning work to awaiting collection; previous attempt history remains. Contact waiting times remain OPEN.
- Prepared unpaid drinks and authorized unpaid handovers are retained as loss/exception records, not successful paid sales. Authority to approve an exception does not establish payment.
- Preserve successful payment evidence for canceled orders, duplicate actual payments, mismatches and erroneous confirmations; do not silently change history or prepare twice. Matching/correction/reconciliation procedures remain OPEN pending merchant review.
- Full refunds are executed outside this application in MVP v2; authorization is separate from proof of execution. Keep original payment, reason, approver and confirmed refund evidence. Unknown results stay pending for reconciliation; no blind repeat or implied refund success. Exact operational evidence remains OPEN.
- Substitutions/partial fulfillment/partial refunds remain deferred. Post-payment unavailability requires supervisor/owner resolution through the retained full-refund/replacement-offer policy; do not automatically charge or create a replacement.

## 4. Employee and service controls

Individual authenticated employees may hold multiple roles. No implicit role hierarchy. Retain owner menu/price/directory/account authority, preparation availability controls, supervisor/owner reassignment and financial exception authority. V2-3 adds owner Team creation/editing/disabling and mandatory first-login password change. Administrative edits revoke target sessions and retain task ownership for supervised recovery. Verifier/Phase 2 permissions and production provisioning remain open.

Queues must remain usable when notifications are missed or sound is blocked. Pauses must not hide existing orders; preparation/owners may persistently pause new court submissions while existing work continues. Delivery/owners can pause delivery: stop new court submissions and delivery claims; keep assigned work progressing. Either pause blocks fresh court checkout; resuming one does not clear the other. Wait-estimate permissions remain OPEN. Staff task views should show the next action in plain language, with advanced exception details disclosed only when needed.

## 5. Counter, pickup and dine-in — Phase 2

Deferred until court Phase 1 is accepted and further development approved. Detailed counter-entered court delivery timing, customer/counter pickup/dine-in payment rules, role permissions and handoff are not settled by the earlier ambiguous “yes.” Preserve existing code/data and prior pickup-code/table requirements for review; do not silently place these services in the court-only release.

## 6. Outage and resumption

Use a supervisor-numbered manual log and official merchant tools. Retain B27's conservative acceptance rule: new outage orders require official payment verification; otherwise stop new orders and continue already verified work. Normal online court prepayment changes do not automatically relax outage rules.

After recovery, the designated supervisor matches manual/online orders and merchant evidence, resolves overlaps and physical-work discrepancies, and approves resumption. Imports must not re-release completed work or count collections twice. Log fields, cutover, permissions, reconciliation deadlines and degraded-verification handling remain OPEN. Recovery targets are in `RELIABILITY.md`; manual references alone do not restore complete order data.

## 7. State and implementation boundary

Track payment separately from preparation/delivery and exceptions. The v1 states and paid-before-queue database triggers are implemented history, not the v2 state specification. New transitions must support unpaid court preparation but require verified payment or an authorized unpaid exception for handover/completion; an exception never becomes a paid sale. Approve detailed states/aging and add new reviewed migrations before changing code. Existing simulator controls remain local test tools, not the normal v2 interface or a production verification method.

## V2-3 local workflow reference

See [decision 007](decisions/007-delivery-and-team.md) for exact current permissions and [verification/startup](VERIFICATION-V2-3.md) for local tests. Original destination is immutable; privileged active-court correction is recorded separately. Unpaid handover is a distinct privileged actual-handover record, never a mark-paid or ordinary completion path. Temporary credentials grant password setup/logout only; choosing a new password atomically revokes all sessions and requires fresh sign-in.
