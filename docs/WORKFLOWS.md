# LISI BNB ERP — Workflows

**Status:** Draft. Confirmed business behavior is distinguished from proposed mechanics and open rules.  
**Updated:** 2026-10-13

## 1. Actors and channels

- **Guest customer:** Orders on responsive website without account. Can arrive via court QR or café QR.
- **Counter staff:** Authorized employee creates an order on behalf of a walk-in customer. Which role(s) may do this is **OPEN**.
- **Preparation employee:** Sees verified paid orders, claims work, prepares, marks ready; can update product availability.
- **Delivery employee:** Sees ready court orders, claims, collects and marks delivered.
- **Supervisor:** Authorizes cancellations/refunds; other permissions **OPEN**.
- **Owner:** Manages operations and sees basic reporting; authorizes cancellations/refunds.

Multiple employees may have each role; multi-role accounts should be supported. A shared café device and employee smartphones are expected.

## 2. Customer ordering — confirmed business sequence

1. Customer scans a **court-specific ordering QR** or accesses the café ordering website.
2. If opened via court QR, the building/court is preselected; customer may change it. For pickup/dine-in, select the appropriate service mode.
3. Customer views available products, selects items and quantities, reviews cart and total.
4. Customer checks out as a guest and is shown a payment method/QR. Provider-specific mechanics are **OPEN**.
5. System waits for **trusted verification of payment**. A screenshot, customer click, or redirect alone is not proof.
6. After verified payment, the order automatically becomes visible in the shared preparation queue.
7. Customer can access order status without requiring an account; exact lookup mechanism is **OPEN**.

**Do not** submit an unpaid order to preparation. **Do not** make order creation depend on the customer keeping the browser open after payment.

## 3. Employee-entered counter order

1. Authorized staff select pickup/dine-in/court delivery and enter items and location if relevant.
2. System creates a traceable order and initiates an approved payment method.
3. Only a trusted confirmation permits preparation.
4. Order follows the same fulfillment and reporting rules as customer-created orders.

**OPEN:** Counter payment methods (QRIS, cash, EDC), who verifies them, receipt handling, and whether a staff-assisted transaction can be marked paid manually. Do not invent a cash path.

## 4. Preparation — confirmed sequence

1. A **verified paid** order appears automatically in a shared kitchen queue.
2. Preparation employee claims the order.
3. Employee prepares items and marks the order ready.
4. Court delivery orders enter the shared delivery queue; pickup/dine-in orders enter the ready/handoff path.

**PROPOSED:** Claiming is atomic so only one employee owns an order at a time; supervisors may release/reassign stale claims. **OPEN:** Multi-item partial readiness, priority, timers, cancellation after cooking begins, item substitutions, order modifications and claim timeout.

## 5. Delivery — confirmed sequence

1. A ready **court delivery** order appears in a shared delivery queue with building, sport/court and order identifier.
2. A delivery employee claims it, collects it from the café and travels to the selected court.
3. Employee marks delivered/completed.

**PROPOSED:** Separate `ready`, `claimed_for_delivery`, `out_for_delivery`, `delivered` operational states. **OPEN:** Customer unavailable, wrong court, failed delivery, return-to-café, proof of handoff, batching and who can change destination after payment.

## 6. Pickup and dine-in — confirmed sequence

1. Preparation marks order ready.
2. Order becomes visible for pickup/dine-in handoff rather than entering court delivery.
3. Authorized staff confirm handoff/completion.

**OPEN:** Dine-in table identification, customer-facing ready notifications, pickup identity verification and unattended ready orders.

## 7. Busy periods and availability

- Staff can pause services and adjust estimated wait times (**CONFIRMED**).
- Preparation staff and owner can mark products available/unavailable (**CONFIRMED**).
- **OPEN:** Who can pause each channel, whether pause affects new checkouts or only new carts, whether existing paid orders remain fulfillable, how estimated waits are calculated, and whether delivery-only pause is supported. These must be decided before implementation.
- **PROPOSED SAFETY RULE:** Pausing does not cancel or hide already paid orders; display an explicit service-unavailable message before checkout.

## 8. Cancellations, refunds and exceptions

- Cancellation/refund authorization: designated supervisor or owner (**CONFIRMED**).
- **OPEN:** Cancellation eligibility by state; full/partial refund support; payment provider refund capability; refund vs void; non-delivery; stock-out after payment; payment disputes; notification to customer; financial reporting effects.
- **PROPOSED SAFETY RULE:** Record actor, reason, timestamp, original transaction and refund reference. Never erase original financial history.

## 9. Outage and manual workflow

1. Staff identify website/internet/payment-provider outage and stop relying on unavailable digital features.
2. Use a separate **manual order log** and existing official merchant payment tools.
3. Verify payment in the merchant's trusted records; do not accept screenshots as sufficient proof.
4. Prepare/deliver manually under a documented procedure.
5. After recovery, reconcile manual orders and merchant transactions against online records; mark duplicates and discrepancies before reporting totals.

**OPEN:** Log fields, numbering, device/paper availability, staff ownership, re-entry permissions, payment verification without connectivity, reconciliation deadline and discrepancy escalation. Manual log is **not** an independently writable second live ERP database.

## 10. State model — design proposal, not finalized

Payment and fulfillment must be tracked separately rather than conflated into one `status` field.

- **Proposed payment states:** `pending`, `verified_paid`, `expired`, `failed`, `refund_pending`, `partially_refunded`, `refunded` (subject to provider capabilities).
- **Proposed fulfillment states:** `awaiting_payment`, `queued_for_preparation`, `preparing`, `ready`, `claimed_for_delivery`, `out_for_delivery`, `completed`, `canceled`, `exception` (some states apply only to delivery).
- **Non-negotiable invariant:** No transition into active preparation unless trusted payment verification is recorded or an explicitly approved, separately specified exception exists.

The state machine, authorized transitions, concurrency rules and financial effects must be approved before coding.
