# Open questions

## Before production use

- Secure first-owner provisioning and employee account lifecycle; no production provisioning command exists in Milestone 1.
- Password recovery/delivery and owner/supervisor MFA policy.
- Hosting, trusted proxy/client-IP handling, HTTPS, secret rotation, backups and demonstrated recovery targets.
- Separate least-privilege production runtime and migration database credentials; local database owners are not a production permission design.
- Production throttling tuning and retention/cleanup of expired sessions/rate-limit records.
- Full operational permission matrix; foundation implements only identity and owner diagnostic access.

Remaining payment/order/location/reporting decisions remain in `DECISIONS.md` O01–O16. They are not silently resolved by the foundation.

Milestone 2 settles fixed final-inclusive prices, deferred variants, bilingual UI and owner-only directory management starting empty; see `decisions/002-catalog.md`. Before checkout: decide whether zero-price orders are permitted, plus pending-payment availability and the remaining ordering/fulfillment rules. Real menu content/translations and locations must be supplied by the owner before customer use.
