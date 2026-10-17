# Data model

**2026-10-16 — v2 requirements and implementation boundary:** [Court-first/manual QRIS decision](decisions/004-court-first-manual-qris.md) requires unpaid court preparation, separate payment/handover state, durable exclusive task ownership, supervised unpaid exceptions and auditable external refund records. Payment records must include amount/method/verifying employee/timestamps; actual merchant evidence/reference fields and matching constraints require the blocked merchant review before payment-verification implementation. New court deadlines/state transitions also need approval. Do not copy demo-only `evidence_mode`, mandatory demo transaction IDs, universal 15-minute expiry or accepted-payment-before-queue constraints as v2 requirements. Preserve snapshots/history/test provenance and evolve via new reviewed migrations, never by editing applied migrations or relabelling simulated payments as real. Counter/pickup/dine-in rules are Phase 2. The approved V2-1 schema extension is documented below; merchant payment-proof and later task entities are not implemented.

The following describes the **implemented v1 schema**, retained as technical history until revised migrations are implemented and tested:

Milestone 1 contains only employee authentication and environment isolation:

- `user`: Better Auth identity, unique email, enabled flag.
- `account`: credential hash linked to identity; unique provider/account identity.
- `session`: unique opaque token, employee foreign key, creation/absolute-expiry timestamps and server-owned last-activity timestamp. No client writes to session policy fields.
- `verification`: Better Auth schema compatibility; password recovery is not enabled.
- `rate_limit`: persistent Better Auth login-throttling records.
- `employee_role`: one row per employee/role, composite uniqueness, checked role vocabulary: preparation, delivery, supervisor, owner, plus counter in Milestone 3. Roles are never accepted from login requests.
- `environment_marker`: one environment designation created by guarded local setup and checked by migrations/test tooling/readiness.

Foreign keys prevent orphan records. Disabling an employee deletes sessions in the same database transaction; a session-insert trigger locks/checks its employee to prevent a concurrent login from restoring access.

Milestone 2 adds:
- `product`: original/optional English name, category and description; exact nonnegative integer-IDR inclusive price; availability, visibility and edit version.
- `building`: stable identity/name, active flag and edit version; case-insensitive trimmed-name uniqueness.
- `location`: stable court/numbered-table identity linked to a building, checked kind/positive table number, active flag and edit version. Names are unique within building/kind. Inactive parent buildings hide their locations.
- `catalog_event`: actor, entity identity, before/after values and timestamp, committed atomically with each catalog mutation. Restrictive employee FK preserves actor attribution; no application deletion endpoint exists.

Product/location identities are retained on archive/inactivation. Application version checks prevent stale overwrites.

Milestone 3 adds:
- `customer_order`: stable operation/order ID and request digest, hashed private recovery key/deadline, guest/counter attribution, immutable customer/destination/total snapshots, separate fulfillment state/reason, demo evidence mode and payment deadline. Contact is private order data, never a public lookup credential.
- `order_item`: immutable names/descriptions, quantity and integer-IDR unit-price snapshots; deferred database checks require 1–50 items and exact header total.
- `payment_transaction`: immutable, authenticated simulated successful funds, identity, amount/match flag and at most one primary payment per order. Distinct extra payments remain separate; repeated notifications cannot add funds twice.
- `refund`: full payment-linked amount, reason/actor and pending/succeeded/failed result. One pending/succeeded full refund per payment; terminal results and amounts cannot be rewritten. Refunding the primary payment cancels preparation eligibility.
- `financial_event`: immutable normalized evidence, source/simulation label, digest and processing outcome; event identity is unique.
- `demo_inbox`: immutable signed simulation evidence and issuing employee, retained independently before financial processing. Undelivered/failed processing remains visible and replayable.
- `order_event`: immutable creation/cancellation/expiry/refund-request history with actor/system attribution.

Database constraints/triggers protect totals, snapshot immutability, accepted-payment eligibility and refund linkage. Amount arithmetic uses integers/BigInt, including aggregate received/refunded totals returned as exact decimal strings. No financial-history deletion API exists. The schema currently permits demo evidence only; real-provider persistence requires a reviewed extension before pilot use.

## V2-1 schema extension — implemented 2026-10-16

Migrations `0005_court_ordering.sql` and `0006_preserve_session_expiry.sql` add unique nullable `public_reference`, distinguish `demo`/`court_test`, and allow a null order payment deadline/demo transaction only for court-test guest orders. V2 begins `awaiting_preparation`; v1 states and deadlines remain protected. Court references/provenance/prices/access deadlines are immutable (access may only shorten); canceled court work cannot be reopened. Demo financial evidence/ledger writes cannot pay court-test records. Final employee `session.expires_at` remains NOT NULL; the corrective migration preserves the history of the test-applied migration correction. Schema generation snapshots reflect the final constraints.

No payment-proof schema or task-assignment entities are added speculatively; those require their separately approved milestones/merchant review. No existing data is relabelled or deleted by these migrations.
