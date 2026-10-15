# LISI BNB ERP — Product Scope

**Status:** Requirements baseline; Milestones 1–2 approved, later milestones and launch require separate approval

**Updated:** 2026-10-14
**Source:** Confirmed business-design decisions from four design rounds, subsequent MVP scope revision and owner-approved review defaults (DECISIONS B23–B31, 2026-10-13). Documentation approval is not implementation authorization.

## 1. Purpose and success criterion

LISI BNB ERP supports one café/kitchen serving customers at the café and padel/tennis courts across multiple buildings in a sports complex. Customers can order through a mobile-friendly website; authorized staff can also enter orders. Customers must pay **before preparation starts**. Preparation and delivery are separate operational roles, with potentially multiple employees in each role. The owner needs dependable order visibility and basic sales reporting.

**MVP success:** A real order can be created, paid and independently verified, prepared, handed off/delivered, and accurately reflected in sales history, including recoverable failure cases. The system must be usable on a shared café device and staff smartphones.

## 2. Confirmed scope

### Customer and counter ordering
- Responsive web experience for customers, employees and owner; no dedicated native app required for MVP.
- Court-specific QR codes open the ordering website and preselect the court; customers can change the selected location.
- Support court delivery, café pickup and dine-in; use order-specific pickup codes, numbered dine-in tables and explicit building/court confirmation. Directory and handoff details remain open.
- Guest checkout; customer accounts are not required.
- Milestone 2 supports bilingual Bahasa Indonesia/English browsing and owner-managed location setup starting empty; see `docs/decisions/002-catalog.md` for the approved module boundary.
- Support both QR self-ordering and employee-entered counter orders.
- Menu browsing, cart, checkout, and order status are part of the operational ordering flow.

### Payments
- **Verified payment is a prerequisite for kitchen preparation.** Do not trust a customer screenshot or customer assertion as proof of payment.
- The desired customer experience is: scan ordering QR, choose products, then view/save a separate payment QR (possibly QRIS paid through BCA/myBCA). Merchant/provider and integration capabilities are **not confirmed**.
- MVP accepts QRIS only, including counter orders, conditional on trusted automatic verification; cash/EDC are deferred.
- Eligible paid orders appear automatically in preparation after trustworthy verification. Late payments on canceled/expired orders require supervisor review, defaulting to refund rather than automatic preparation; extra verified duplicate payments are refunded without duplicate fulfillment.
- Payment provider, QR generation, webhook/API access, settlement, expiration mechanics and refund execution remain open; no production payment implementation may be assumed.

### Demo-first payment development — confirmed B32
- Use simulated payments for development/testing in non-production while merchant selection is pending. This unblocks provider-independent work; other affected-module decisions still need approval.
- Keep the payment-provider integration replaceable, with shared server-side order/payment rules. Demo controls supply simulated provider outcomes through that processing boundary rather than bypassing business rules.
- Clearly label demo payment displays and transaction history as simulated; do not present a payable QR or real merchant receipt. Isolate demo records from production orders, payment evidence and financial reports.
- Production must reject demo configuration, controls and simulated evidence. Missing or invalid real-provider configuration must leave payment acceptance unavailable, never fall back to demo.
- Real provider capabilities, authentication, transaction matching, reconciliation and refund procedures must be validated before a real-money pilot. Demo success does not establish provider compatibility or eliminate integration/testing work.

### Employees and fulfillment
- Preparation and delivery are separate roles; multiple staff members may perform either role, and users may be authorized for multiple roles.
- Preparation queue is shared; staff claim orders themselves.
- Court orders marked ready enter a shared delivery queue; delivery staff claim, collect and deliver them.
- Pickup and dine-in orders use a ready/handoff path rather than a court-delivery queue.
- Preparation staff may pause the kitchen; supervisors manage service pauses. Staff can adjust displayed wait estimates; their permissions and pause/pending-payment effects remain open.
- Only supervisors/owners release or reassign claimed work after checking physical progress. No automatic claim expiry; previous assignees cannot continue acting after reassignment.
- Unpaid orders may be canceled. Paid cancellation/refund requires supervisor/owner approval; full cancellation is normally allowed before preparation, with individual exception review afterward. Partial refunds are deferred; uncertain refund results remain pending reconciliation before retry.
- Preparation staff and owner can change product availability.
- Recheck availability at checkout and freeze agreed prices. If fulfillment becomes impossible after payment, a supervisor resolves it through a full refund and replacement-order offer. Substitutions and partial fulfillment are deferred.
- Absent court customers trigger failed-delivery recording, an attempt through the agreed contact method and return to café; not automatic completion. Contact details and final resolution remain open.
- Staff receive live dashboard updates with audible and visual new-order alerts.

### Management and reporting
- Owner dashboard prioritizes today's revenue, order count, best-selling products and order history.
- Menu uses one fixed final inclusive integer-IDR price per item. Variants/modifiers are deferred. Owners manage the building/court/numbered-table directory; owner-supplied English menu translations are optional.
- Designated counter staff enter orders; preparation staff control availability/kitchen pauses; supervisors manage service pauses, reassignment and destination corrections; owners control prices, accounts and financial reporting. Use individual accounts on shared devices and server-side authorization; the complete matrix still needs approval.
- Reports use Asia/Jakarta midnight-to-midnight: verified payments received, confirmed refunds issued and their difference are separate from merchant settlement. Count unique paid orders, not duplicate payments; remaining revenue/best-seller rules are open.
- Maintain transaction history sufficient for accurate basic reporting and future inventory/accounting additions.

### Outage operations
- If website/internet fails, employees switch to a separate manual order log and existing merchant payment tools, then reconcile when service returns.
- Manual records must be distinguished from online orders to avoid double counting; only verified merchant payments may be recorded as paid.
- Accept new manual orders only when official merchant records can verify payment; otherwise stop new orders and continue already verified work. A designated supervisor numbers manual records, resolves overlaps and approves return online.
- Recovery target: digital service within one hour, with no permanent loss of paid-order details. Feasibility must be demonstrated through drills; recovery design and other data-loss tolerances remain open.

## 3. Initial MVP boundary — latest decision supersedes Round 4

**IN MVP:** Ordering, trustworthy payment verification, kitchen and delivery operations, pickup/dine-in handoff, menu/product availability, staff roles, service controls, basic sales reporting, notifications, outage fallback and reconciliation.

**AFTER MVP PILOT/STABILIZATION:** Advanced inventory (ingredient-level stock, recipes, automatic consumption, waste, restocking, stock alerts) and advanced accounting (bookkeeping/general ledger, COGS, financial statements, detailed expense management). These are **explicitly deferred**, superseding the Round 4 answer to include them in the first release. Preserve reliable order/payment/product records so later modules can be added without fabricating history.

**Additional confirmed MVP deferrals:** Cash/EDC, partial refunds, substitutions and partial fulfillment (B23/B25/B29). Full refunds and duplicate-payment recovery remain essential.

**Proposed exclusions, pending business validation:** Court booking, sports-club membership, payroll, loyalty, procurement automation, multi-kitchen/multi-branch management and advanced forecasting.

## 4. Design principles and boundaries

- One modular monolith with clear modules for ordering, payment, operations and reporting. Approved stack: TypeScript/Next.js, PostgreSQL, Drizzle, Tailwind, Vitest and Playwright. Better Auth is approved subject to configuration/testing review. Hosting and payment provider remain unselected.
- Single authoritative order/payment state; avoid independent competing transaction records.
- Server-side enforcement of business rules and authorization; frontend displays do not establish payment truth.
- Operational safety over feature breadth: explicit state transitions, concurrency protection, traceability, retries, reconciliation and manual recovery.
- Build in small, independently verifiable milestones. No claim of zero possible failures; design to detect, contain and recover.

## 5. Rollout

**Confirmed:** Internal testing → limited real-order pilot → full public launch. Before any real-customer use, payment verification, end-to-end tests, role security, recovery procedures and staff training must pass. The pilot is a production activity with real money and must meet the same payment/security baseline; pilot success criteria and traffic limits remain open.

## 6. Open decisions / launch blockers

See `docs/DECISIONS.md` for the authoritative decision register. Especially important:
1. Real integration/pilot gate: merchant/payment provider and supported programmatic confirmation/refund methods for the QRIS-only MVP; outage verification/import evidence. Non-production demo development is permitted under B32 while merchant selection is pending.
2. Actual court/building/table entries, printed QR placement, coverage, secure guest recovery and detailed pickup/delivery handoff. Owner-only directory management starting empty is approved for Milestone 2.
3. Actual menu/prices, discounts, zero-price checkout policy, pending-payment availability and replacement-order handling. Fixed final-inclusive prices and deferred variants/modifiers are approved.
4. Exact order/payment transitions, edit limits, cancellation exceptions, refund execution, unknown outcomes and expiration mechanics under B24/B25/B29.
5. Complete permission matrix, account/session lifecycle, physical reassignment checks and shift coverage under B26/B28.
6. Pause behavior, estimated waits, order throttling and notification fallback.
7. Remaining revenue/count/best-seller definitions and reconciliation under the confirmed Asia/Jakarta day and collection/refund displays.
8. Recovery design/measurement and drills for B31, other RPOs, PostgreSQL backups, hosting/monitoring and optional Google Sheets **read-only reporting mirror**.
9. Manual ledger format, outage cutover, overlap resolution and post-outage reconciliation under B27.
10. Privacy/security, retention, operating constraints and relevant Indonesian regulatory/provider requirements.

## 7. Change control

A requirement marked **CONFIRMED** reflects the conversation. **PROPOSED** means a recommendation, not approval. **OPEN** means no decision yet. If documents disagree, pause implementation, record the conflict in `docs/DECISIONS.md` and obtain an explicit decision. Do not silently infer payment, accounting, authorization or order-lifecycle rules.
