# Milestone 3 — Ordering with demo payments

**Historical v1 scope:** The 2026-10-16 [MVP v2 decision](004-court-first-manual-qris.md) supersedes conflicting payment-first, expiry/cancellation and phase rules below. Existing implementation/test evidence remains v1; do not interpret this original approval as permission to implement v2 payment verification or as a gateway requirement for the revised MVP.

2026-10-15. **CONFIRMED for Milestone 3.** The owner instructed proceeding after the seven recommended defaults and the milestone outcome were presented. This approves the rules/state behavior below for non-production demo implementation; it does not authorize real payments or Milestone 4.

## Scope

Bilingual customer cart, guest checkout, court/pickup/dine-in selection, durable order/status access, authorized counter entry and isolated non-payable demo payments. Preserve the Milestone 2 visual direction. Preparation/delivery task screens and account-management UI remain Milestone 4; real provider integration remains Milestone 6.

## Confirmed decisions

1. **Price/edits:** No discounts or zero-price items in checkout for this milestone. Recheck server prices/availability and require customer review if the cart price changed. Successful checkout freezes item descriptions, unit prices, quantities, total and destination. No edits after order creation: cancel an unpaid order and create a replacement.
2. **Demo deadline/retry:** An unpaid order has a 15-minute demo payment window, measured on the server. Confirmed failure, expiry or cancellation closes that order; a customer can create a new one. Preserve the original order/payment history. A later successful payment on the closed order enters review with refund as the default and never releases preparation. Actual provider deadlines/retry capabilities remain unconfirmed.
3. **Availability:** No stock reservation. Check at checkout and again when accepting payment success. If a product or selected destination became unavailable/inactive while payment was pending, preserve successful simulated payment evidence, hold the order for owner/supervisor review and default to a full refund. Later menu changes do not automatically rewrite already accepted paid orders.
4. **Counter permissions:** Add an explicit `counter` employee role, compatible with multiple roles per account. Counter staff and owners can create counter orders. Supervisors/owners can cancel any unpaid order and authorize paid cancellation/refunds; counter staff can cancel their own unpaid counter orders. Other existing roles gain no implicit counter authority.
5. **Guest status/recovery:** Give the guest an unguessable private status/recovery link, valid for 24 hours after creation. Retain it for normal browser reopening and let the customer copy/save it. Order number or pickup code alone never grants online lookup access. Without the private link, direct the customer to staff; no public recovery by name/phone and no email/SMS integration in this milestone. A guest with the private link can cancel their own unpaid order, not a paid one. Losing the link does not delete the stored order.
6. **Contact/handoff:** Require a display name for all orders, plus a phone/WhatsApp number for court delivery only. Contact is manual; no messaging integration. Court delivery requires explicit active building/court confirmation; dine-in requires an active numbered table; pickup receives a random order-specific handoff code, distinct from online access credentials. Never expose contact details in public menu responses or logs. Actual handoff completion remains Milestone 4.
7. **Demo controls/refunds:** Only authenticated owners/supervisors can operate simulated payment/refund controls. Guests/counter staff cannot mark payments successful. Simulate pending/success/failure/expiry and repeat/delayed/out-of-order events through server-owned processing, with evidence/amount/currency/order/transaction validation. Full simulated refunds only, authorized by owner/supervisor; an unknown result stays pending until reconciled rather than being blindly retried. No payable QR, real merchant credentials or real money movement.

## Approved state behavior for this milestone

Payment evidence and fulfillment are separate. Each payment transaction/refund has its own identity and retained history; duplicate notifications are distinct from a second actual simulated payment.

- Order starts `awaiting_payment`.
- Accepted simulated success before the deadline, with valid evidence and available items/destination, transitions once to `queued_for_preparation`. This is durable eligibility for Milestone 4, not a working kitchen queue or a claim that real merchant payment was verified.
- Unpaid cancellation, confirmed failure or expiry transitions `awaiting_payment` to `canceled`, retaining a reason.
- Success after a closed order, or success with newly unavailable items/destination, transitions to `exception` for supervisor/owner review. Default resolution is full refund; no automatic release from review in this milestone.
- A distinct extra successful payment on an otherwise eligible paid order is retained for a separately authorized full refund; it never creates a second order/fulfillment or cancels the original valid payment automatically.
- Authenticated but mismatched payment evidence is retained for investigation without releasing work. Untrusted/forged input cannot establish payment evidence.
- Owner/supervisor cancellation of a paid queued order cancels fulfillment and requests a full simulated refund. Confirmed refund updates financial history; failed/unknown requests cannot imply success.
- Failed, expired, duplicate or out-of-order notifications never undo a recorded success/refund. Repeated operations have one committed financial effect.
- No transitions into preparation, ready, collection, delivery or completion are exposed in Milestone 3.

This milestone does not resolve post-preparation cancellation exceptions, physical handoff, service-pause behavior, manual outage imports or real-provider semantics. Resolve those before their affected implementation.

## Small implementation plan

1. Record confirmed decisions; add reviewed additive order/item/payment/event/refund/access and counter-role migrations. Preserve current menu, locations and employee accounts.
2. Add cohesive order/payment services under `src/server/` and shared input/state definitions under `src/ordering/`; keep business logic out of components and route handlers. Use exact integer IDR, database constraints/transactions and stable retry identities.
3. Extend the existing customer menu/cart; add checkout and private status/recovery UI. Add protected counter entry and minimal demo-control pages, not operational dashboards.
4. Permit explicit demo configuration only in development/test; reject demo ordering, controls and evidence in production even through direct requests. Do not fall back to demo when configuration is missing. No new infrastructure or payment-provider selection.
5. Add unit, actual PostgreSQL integration and packaged-app Chromium tests, then update local usage and verification documentation. Stop before Milestone 4.

## Acceptance

- Guest and authorized counter users can create persisted simulated orders in all three fulfillment modes without customer registration. Displayed totals match independently checked integer-IDR item snapshots.
- Changed prices require review, unavailable/invalid inputs are rejected, existing snapshots survive later catalog edits and application restart/browser closure.
- Repeated checkout/network retry produces one order; concurrent success/cancel/expiry processing has an auditable permitted outcome and no duplicate financial effect or preparation eligibility.
- Invalid/duplicate/out-of-order/mismatched events, late/extra payments, unknown refunds and post-checkout availability changes follow the confirmed policies with retained evidence.
- Guest access isolation, current role/session checks, input/origin protection, abuse limits and production rejection of demo functionality are tested server-side. No credentials/guest access secrets/contact details appear in logs.
- Bilingual responsive loading/empty/error/success flows and truthful uncertainty after network failure are tested. Foundation/catalog regressions, migrations, type/lint/build checks pass.

Actual payment capture, provider callbacks, settlement and merchant refunds cannot be validated by demo tests; their evidence remains a real-integration/pilot gate.

## Implementation choices

- Guest recovery credentials travel in URL fragments and POST bodies, never query strings/path credentials; only their hashes are stored on the server. Browser drafts/links expire logically after 24 hours and are cleaned on next use; the server enforces access expiry independently. Counter drafts use employee-scoped session storage and are cleared on sign-out. This is a non-authoritative draft/recovery aid; PostgreSQL retains all committed order/financial history.
- Database time enforces deadlines on every relevant operation. Expiration does not need a timer process: an order past its stored deadline cannot become eligible even before its next status read records expiration.
- An independent local demo signing secret authenticates simulated provider evidence. A durable demo inbox supports delayed/missing delivery and explicit reconciliation. No public webhook or guest mark-paid endpoint is introduced.
- Each order is serialized for checkout retries and financial transitions. Exact integer arithmetic and database snapshot/ledger constraints protect amounts; row versions are not client authority for payment status.
- Technical demo bounds: 50 different items, 1–99 units per item, total at most PostgreSQL's positive integer range; guest checkout attempts share a persistent 30/minute local-demo throttle, and counter attempts are limited per employee. Guest status/cancel lookups share a 300/minute demo limit. Rejected database-dependent attempts count toward limits. Production traffic/retention policy remains a launch gate.
