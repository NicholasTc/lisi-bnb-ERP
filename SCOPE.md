# LISI BNB ERP — Product Scope

**Status:** Draft baseline for review; not authorization to implement or launch  
**Updated:** 2026-10-13  
**Source:** Confirmed business-design decisions from four design rounds and subsequent MVP scope revision.

## 1. Purpose and success criterion

LISI BNB ERP supports one café/kitchen serving customers at the café and padel/tennis courts across multiple buildings in a sports complex. Customers can order through a mobile-friendly website; authorized staff can also enter orders. Customers must pay **before preparation starts**. Preparation and delivery are separate operational roles, with potentially multiple employees in each role. The owner needs dependable order visibility and basic sales reporting.

**MVP success:** A real order can be created, paid and independently verified, prepared, handed off/delivered, and accurately reflected in sales history, including recoverable failure cases. The system must be usable on a shared café device and staff smartphones.

## 2. Confirmed scope

### Customer and counter ordering
- Responsive web experience for customers, employees and owner; no dedicated native app required for MVP.
- Court-specific QR codes open the ordering website and preselect the court; customers can change the selected location.
- Support court delivery, café pickup and dine-in. Details of dine-in location identification remain open.
- Guest checkout; customer accounts are not required.
- Support both QR self-ordering and employee-entered counter orders.
- Menu browsing, cart, checkout, and order status are part of the operational ordering flow.

### Payments
- **Verified payment is a prerequisite for kitchen preparation.** Do not trust a customer screenshot or customer assertion as proof of payment.
- The desired customer experience is: scan ordering QR, choose products, then view/save a separate payment QR (possibly QRIS paid through BCA/myBCA). Merchant/provider and integration capabilities are **not confirmed**.
- Paid orders appear automatically in the preparation queue after trustworthy verification.
- Payment provider, QR generation, webhook/API access, settlement, expiration, refunds and staff-entered payment procedures remain open; no production payment implementation may be assumed.

### Employees and fulfillment
- Preparation and delivery are separate roles; multiple staff members may perform either role, and users may be authorized for multiple roles.
- Preparation queue is shared; staff claim orders themselves.
- Court orders marked ready enter a shared delivery queue; delivery staff claim, collect and deliver them.
- Pickup and dine-in orders use a ready/handoff path rather than a court-delivery queue.
- Staff can pause services and adjust displayed wait estimates. Exact permissions, scope of pause and wait-time rules are open.
- Only designated supervisors and owners can authorize cancellations and refunds. Exact timing and procedures are open.
- Preparation staff and owner can change product availability.
- Staff receive live dashboard updates with audible and visual new-order alerts.

### Management and reporting
- Owner dashboard prioritizes today's revenue, order count, best-selling products and order history.
- Role-based access distinguishes preparation, delivery, supervisor and owner permissions; a detailed access matrix still needs approval.
- Maintain transaction history sufficient for accurate basic reporting and future inventory/accounting additions.

### Outage operations
- If website/internet fails, employees switch to a separate manual order log and existing merchant payment tools, then reconcile when service returns.
- Manual records must be distinguished from online orders to avoid double counting; only verified merchant payments may be recorded as paid.

## 3. Initial MVP boundary — latest decision supersedes Round 4

**IN MVP:** Ordering, trustworthy payment verification, kitchen and delivery operations, pickup/dine-in handoff, menu/product availability, staff roles, service controls, basic sales reporting, notifications, outage fallback and reconciliation.

**AFTER MVP PILOT/STABILIZATION:** Advanced inventory (ingredient-level stock, recipes, automatic consumption, waste, restocking, stock alerts) and advanced accounting (bookkeeping/general ledger, COGS, financial statements, detailed expense management). These are **explicitly deferred**, superseding the Round 4 answer to include them in the first release. Preserve reliable order/payment/product records so later modules can be added without fabricating history.

**Proposed exclusions, pending business validation:** Court booking, sports-club membership, payroll, loyalty, procurement automation, multi-kitchen/multi-branch management and advanced forecasting.

## 4. Design principles and boundaries

- One integrated application with clear modules for ordering, payment, operations, reporting and later inventory/accounting; no technology stack, hosting or database selected yet.
- Single authoritative order/payment state; avoid independent competing transaction records.
- Server-side enforcement of business rules and authorization; frontend displays do not establish payment truth.
- Operational safety over feature breadth: explicit state transitions, concurrency protection, traceability, retries, reconciliation and manual recovery.
- Build in small, independently verifiable milestones. No claim of zero possible failures; design to detect, contain and recover.

## 5. Rollout

**Confirmed:** Internal testing → limited real-order pilot → full public launch. Before any real-customer use, payment verification, end-to-end tests, role security, recovery procedures and staff training must pass. The pilot is a production activity with real money and must meet the same payment/security baseline; pilot success criteria and traffic limits remain open.

## 6. Open decisions / launch blockers

See `docs/DECISIONS.md` for the authoritative decision register. Especially important:
1. Merchant/payment provider and supported programmatic confirmation method; treatment of staff-entered orders and cash/other tender.
2. Court/building directory, QR placement, service coverage and dine-in/pickup identification.
3. Exact menu variants, modifiers, prices, taxes, discounts and availability rules.
4. Order/payment state transitions, edits, cancellations, partial fulfillment, refunds, duplicate payments and expiration.
5. Employee roles, account lifecycle, claim/unclaim/reassignment, shift coverage and permissions.
6. Pause behavior, estimated waits, order throttling and notification fallback.
7. Reporting definitions, timezone, business-day cutoff, gross/net/refund metrics and reconciliation.
8. Database, backups, optional Google Sheets **read-only reporting mirror**, infrastructure and monitoring.
9. Manual-order ledger format, outage procedure and post-outage reconciliation.
10. Privacy/security, retention, operating constraints and relevant Indonesian regulatory/provider requirements.

## 7. Change control

A requirement marked **CONFIRMED** reflects the conversation. **PROPOSED** means a recommendation, not approval. **OPEN** means no decision yet. If documents disagree, pause implementation, record the conflict in `docs/DECISIONS.md` and obtain an explicit decision. Do not silently infer payment, accounting, authorization or order-lifecycle rules.
