# Milestone 2 — Menu and location setup

Approved 2026-10-14. Ordering, checkout, payments and operational queues remain outside this milestone.

Owner-confirmed rules:
- One fixed final inclusive integer-IDR price per item; variants/modifiers deferred.
- Only owners manage the building/court/numbered-table directory. Start empty; no invented real menu or location records.
- Customer interface offers Bahasa Indonesia and English. Owner-supplied English menu translations are optional, with original wording as fallback; no automatic translation service.
- Existing permissions apply: owners manage menu/prices; preparation staff and owners change availability. Other roles gain no implied access.

Implementation choices:
- Customer menu at `/`; authenticated editing at `/employee/menu`. Browsing/confirming a court does not place or persist an order.
- Stable court-ID links use `/?court=<id>`. Unknown/inactive/table IDs require correction. Customers explicitly confirm or override the court. Printed QR artifact generation is not implemented.
- Products have a category label, optional description/translations, availability and visibility. Archive/inactivate instead of deleting. Locations retain their original building/type; create a new identity for a moved/retyped location. Renames retain links.
- Reviewed additive migration adds product, building, location and catalog-event tables. Integer prices have a nonnegative database constraint and PostgreSQL integer upper bound; accepting zero-value orders remains a checkout decision.
- Version checks reject stale edits. Client-generated creation IDs remain stable on retries, preventing repeat creation with the same ID. Conflicts require refresh and review rather than automatic overwrite/retry.
- Mutations and actor/before/after audit records commit together. No new infrastructure or dependencies.
- Public responses omit staff identities, audit records and editing metadata. Directory reads include only active locations in active buildings. Unavailable visible items remain labeled; archived products are hidden.

Acceptance: real PostgreSQL integrity, role/origin/input denial, atomic audit rollback, concurrent-edit/retry safety, bilingual responsive browsing, staff editing, active QR validation/override and truthful network failure feedback. Production readiness and all later milestone gates remain separate.
