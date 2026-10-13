# LISI BNB ERP — Workflows

**Status:** Draft. Confirmed business behavior is distinguished from proposed mechanics and open rules.  
**Updated:** 2026-10-13

## 1. Actors and channels

- **Guest customer:** Orders on responsive website without account. Can arrive via court QR or café QR.
- **Counter staff:** Designated employee enters walk-in orders; assignment of this permission to roles/accounts is **OPEN**.
- **Preparation employee:** Sees verified paid orders, claims work, prepares, marks ready; can update product availability.
- **Delivery employee:** Sees ready court orders, claims, collects and marks delivered.
- **Supervisor:** Authorizes cancellations/refunds, manages service pauses, task reassignment and destination corrections; detailed limits remain **OPEN**.
- **Owner:** Controls prices, accounts and financial reporting; authorizes cancellations/refunds and may release/reassign claimed work.

Multiple employees may have each role; multi-role accounts should be supported. A shared café device and employee smartphones are expected. **CONFIRMED:** Individual accounts and server-side authorization are required, including on shared devices. Session switching, revocation, account recovery and the full permission matrix remain **OPEN**.

## 2. Customer ordering — confirmed business sequence

1. Customer scans a **court-specific ordering QR** or accesses the café ordering website.
2. If opened via court QR, the building/court is preselected; customer may change it and explicitly confirms the final building/court. For pickup/dine-in, select the appropriate service mode; dine-in uses numbered tables.
3. Customer views available products, selects items and quantities, reviews cart and total.
4. Recheck availability at checkout and freeze agreed prices. Customer checks out as a guest and is shown QRIS payment; cash/EDC are deferred. Provider-specific mechanics and stock-out during pending payment are **OPEN**.
5. System waits for **trusted verification of payment**. A screenshot, customer click, or redirect alone is not proof.
6. After verified payment, an eligible order automatically becomes visible in preparation once. Canceled/expired orders require supervisor late-payment review, defaulting to refund. Already manually fulfilled orders are reconciled without releasing work again; this alone does not require a refund. Extra verified duplicate payments are refunded without duplicate fulfillment.
7. Customer can access order status without requiring an account; exact lookup mechanism is **OPEN**.

**Do not** submit an unpaid order to preparation. **Do not** make order creation depend on the customer keeping the browser open after payment.

## 3. Employee-entered counter order

1. Authorized staff select pickup/dine-in/court delivery and enter items and location if relevant.
2. System creates a traceable order and initiates an approved payment method.
3. Only a trusted confirmation permits preparation.
4. Order follows the same fulfillment and reporting rules as customer-created orders.

**CONFIRMED:** QRIS-only MVP, including counter orders, conditional on trusted automatic verification. Cash/EDC are deferred. **OPEN:** Receipt handling, official verification evidence and outage-import permissions/checks. No unrestricted manual-paid control is approved.

## 4. Preparation — confirmed sequence

1. An eligible **verified paid** order appears automatically once in the shared kitchen queue; canceled/expired or already manually fulfilled orders require exception handling rather than automatic release.
2. Preparation employee claims the order.
3. Employee prepares items and marks the order ready.
4. Court delivery orders enter the shared delivery queue; pickup/dine-in orders enter the ready/handoff path.

**CONFIRMED:** Exclusive task ownership is mandatory. Only supervisors/owners release or reassign claimed work after checking physical progress; no automatic claim expiry, and previous-assignee actions are rejected. Substitutions and partial fulfillment are deferred; if fulfillment becomes impossible after payment, a supervisor resolves it through a full refund and replacement-order offer. **PROPOSED MECHANISM:** Atomic claim enforcement. **OPEN:** Priority/timers, physical handoff checks, shift change, order edits and grounds/procedures for cancellation exceptions after preparation starts.

## 5. Delivery — confirmed sequence

1. A ready **court delivery** order appears in a shared delivery queue with building, sport/court and order identifier.
2. A delivery employee claims it, collects it from the café and travels to the selected court.
3. Employee marks delivered/completed.

**CONFIRMED:** For an absent customer, record failed delivery, attempt the agreed contact method and return to café; do not automatically mark delivered. Supervisors manage destination corrections; stage-specific limits remain **OPEN**. **PROPOSED:** Separate `ready`, `claimed_for_delivery`, `out_for_delivery`, `delivered` operational states. **OPEN:** Contact method/attempts, wrong-court procedure, proof of handoff, redelivery/refund resolution and batching.

## 6. Pickup and dine-in — confirmed sequence

1. Preparation marks order ready.
2. Order becomes visible for pickup/dine-in handoff rather than entering court delivery.
3. Authorized staff confirm handoff/completion.

**CONFIRMED:** Numbered dine-in tables and order-specific pickup codes. **OPEN:** Directory, code lifecycle/checks, customer-facing ready notifications, secure guest lookup/recovery and unattended ready orders.

## 7. Busy periods and availability

- Staff can pause services and adjust estimated wait times (**CONFIRMED**).
- Preparation staff and owner can mark products available/unavailable (**CONFIRMED**).
- **CONFIRMED:** Preparation staff control kitchen pauses; supervisors manage service pauses. Existing paid orders must not be canceled or hidden by a pause.
- **OPEN:** Exact channel scope, pause effects on new carts/checkouts and pending payments, continued fulfillment during a service-specific pause, wait-estimate permissions/calculation and delivery-only pause. Decide before affected implementation.
- **PROPOSED UI RULE:** Display an explicit service-unavailable message before checkout.

## 8. Cancellations, refunds and exceptions

- Paid cancellation/refund authorization: designated supervisor or owner (**CONFIRMED**). Unpaid cancellation is supported; detailed actor rules remain **OPEN**.
- **CONFIRMED:** Unpaid orders may be canceled. Paid cancellations/refunds require supervisor/owner approval; full cancellation is normally allowed before preparation, with individual exception review afterward. Partial refunds are deferred. Unknown refund outcomes remain pending reconciliation before retry; never issue a second refund simply because a response was lost.
- **CONFIRMED:** Late payments on canceled/expired orders require supervisor review, defaulting to refund rather than preparation. Refund the extra verified payment on duplicate payment. Post-payment unavailability requires supervisor full-refund resolution and a replacement-order offer; substitutions/partial fulfillment are deferred.
- **OPEN:** Exact transitions, post-preparation exception grounds, refund capability/execution, refund vs void, concurrent refund limits, external merchant refunds, disputes, customer notification and replacement-order linkage. A replacement offer is not automatic creation or charging of a new order.
- **REQUIRED AUDIT:** Preserve original financial history and record actor, reason, timestamp, original transaction and refund reference. Detailed record format remains a design decision.

## 9. Outage and manual workflow

1. Staff identify website/internet/payment-provider outage and stop relying on unavailable digital features.
2. A designated supervisor numbers records in a separate **manual order log**; use existing official merchant payment tools.
3. Verify payment in the merchant's trusted records; do not accept screenshots as sufficient proof.
4. Accept new manual orders only when official merchant records can verify payment. Otherwise stop new orders and continue already verified work. Prepare/deliver manually under a documented procedure.
5. After recovery, the designated supervisor resolves manual/online overlaps and discrepancies and approves return to online operation. Previously fulfilled manual work must not re-enter preparation or be double-counted.

**OPEN:** Supervisor assignment, log fields/numbering format, device/paper availability, cutover when the server remains online, re-entry permissions/evidence checks, reconciliation deadline and resumption checks. Manual log is **not** an independently writable second live ERP database. B31 sets a one-hour digital recovery target and no permanent loss of paid-order details; recovery feasibility and measurement details remain to be validated.

## 10. State model — design proposal, not finalized

Payment and fulfillment must be tracked separately rather than conflated into one `status` field.

- **Proposed MVP payment states:** `pending`, `verified_paid`, `expired`, `failed`, `refund_pending`, `refunded` (subject to provider capabilities). Partial refunds are deferred; any external financial exceptions must still remain auditable.
- **Proposed fulfillment states:** `awaiting_payment`, `queued_for_preparation`, `preparing`, `ready`, `claimed_for_delivery`, `out_for_delivery`, `completed`, `canceled`, `exception` (some states apply only to delivery).
- **Non-negotiable invariant:** No transition into active preparation unless trusted payment verification is recorded. No payment-verification exception or generic override is approved.

The state machine, authorized transitions, concurrency rules and financial effects must be approved before coding.

## 11. Demo payment path — confirmed B32, non-production only

1. A developer/tester creates a demo order; the interface clearly identifies the environment and payment display as simulated and non-payable.
2. Non-production controls exercise simulated pending, success, failure, expiration, delayed/missing/repeated/out-of-order events and refund outcomes. These are test scenarios, not an approval of provider-specific states or mechanics.
3. Server-side simulated evidence passes through the shared order/payment processing rules, including amount/identity checks, idempotency, authorization and eligible queue release. A customer-controlled success display is not payment authority.
4. Demo transactions and reports remain explicitly simulated in an isolated non-production environment. They cannot become production paid-order records, merchant-backed evidence or real sales history.
5. After a merchant is selected, its integration supplies documented real payment evidence through the replaceable provider boundary. Validate capabilities, event authentication, reconciliation and refund behavior before real-money pilot use.

Production refuses demo provider configuration/controls/evidence and never falls back to simulation when the real provider is missing or unavailable. The production payment prerequisite remains unchanged. The provider contract and concrete state mapping remain subject to technical design; demo results are not live integration acceptance.
