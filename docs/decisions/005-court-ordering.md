# V2-1 — Court ordering and customer experience

**Approved implementation:** 2026-10-16. Owner instructed proceeding with the staged plan and explicitly confirmed no automatic cancellation and immediate preparation queue eligibility, with suspicious orders escalated. Payment verification remains blocked under [decision 004](004-court-first-manual-qris.md). No V2-2 or production authorization is implied.

## Approved order behavior

- Successful court submission is immediately eligible for preparation while unpaid. No automatic payment expiry or automatic order cancellation; older orders remain visible for staff resolution. A customer's private link still expires after 24 hours independently of retained order history.
- Customer may cancel only while preparation is unclaimed. V2-1 exposes `awaiting_preparation` and cancellation; actual claims/races and task progress are V2-2, with additional reviewed constraints required then. No generic edit/reopen or completed-state endpoint.
- Retain existing checkout name/court phone/explicit location confirmation, fixed inclusive positive integer-IDR pricing, availability/price review, 50-line/99-unit technical bounds and shared local throttles. These existing technical limits are not validated production capacity/abuse policy. No substitutions or zero-price/discount checkout.
- All new orders are court-only local tests. Counter/pickup/dine-in creation is unavailable in the ordinary UI/API pending Phase 2; historical records remain intact and readable through existing authorized/private access.

## Implementation choices

- Reuse the existing order/item/event tables and transactional checkout service. `evidence_mode=court_test` distinguishes unpaid v2 test orders from legacy `demo` orders. This provenance is immutable; it is not merchant evidence or a future production mode.
- New orders receive a unique `LB-` reference with ten cryptographically random hexadecimal characters. PostgreSQL uniqueness and transaction serialization protect collisions; this reference is not an online access credential. Private keys remain hashed and travel in fragments/POST bodies.
- V2 test orders have no demo transaction or payment deadline; their initial state is `awaiting_preparation`. Exact snapshots and creation/audit commit together. Stable immutable retry bodies survive an uncertain response and cannot substitute a different guest key/body.
- New migrations extend the v1 schema and preserve its historical payment/refund rules. A corrective migration restores mandatory employee session expiry after an unintended nullability change in the first test-applied migration; only court payment deadlines become optional. Previously applied migrations remain unchanged. Final schema/session nullability is covered by PostgreSQL regression tests.
- Demo event processing, ledger insertion and demo inbox/evidence persistence reject v2 orders at service/database boundaries. Public checkout has no manual payment control; production court endpoints stay unavailable. Local court checkout works even with demo payments disabled.
- Browser request generations clear stale order details when the fragment changes and ignore late status/cancel responses from the former private key. Recovery details are collapsed by default; product/cart prices remain visible.
- UI uses white, dark court green, bright red-orange, soft peach/green and restrained yellow accents; Avenir Next/Trebuchet/system fallbacks need no external fonts. Compact court selection, category/search, illustrated drink icons and a persistent cart support mobile use. Checkout shows one court mode; confirmation uses plain language and a smaller reference. Technical/test controls do not enter the ordering path.

## Boundary and evidence

V2-1 provides durable preparation eligibility, not working employee queues, claims, delivery, payment collection or reporting. Customer screens explicitly identify local ordering tests and the unavailable operational/payment stages. Owner UI acceptance, V2-2 claims, merchant procedures and full Phase 1 validation remain separate gates. See [V2-1 verification](../VERIFICATION-V2-1.md).
