# Milestone 1 — Foundation

Approved scope: reproducible Next.js/TypeScript/Tailwind application; PostgreSQL/Drizzle migrations; Vitest/Playwright; environment isolation; health/error handling; reviewed employee authentication/authorization.

Acceptance: clean installation and development startup; type/lint/build checks; real PostgreSQL migrations and integrity/rollback tests; login/logout, inactivity/absolute expiry, disabling/revocation, roles, registration denial, origin checks and throttling tests; browser smoke/login tests; sanitized database-failure readiness response.

No ordering, payments (including demo implementation), operational dashboards, inventory or accounting. No deployment. Milestone 2 requires separate product-owner approval.

Verification evidence is recorded in `VERIFICATION.md` after execution. Outstanding decisions live in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md); confirmed business requirements remain in the existing scope/workflow/decision documents.

# Milestone 2 — Menu and locations

Approved scope and clarified business rules: [catalog decision](decisions/002-catalog.md).

Deliver customer bilingual menu browsing/search/categories and validated court selection; owner menu/directory editing and preparation availability controls. Add catalog services, protected/public routes, responsive pages, additive migration, atomic audit and optimistic edit checks. Preserve the foundation and user-maintained project log.

Acceptance: persistent exact prices; unauthorized and invalid edits rejected; concurrent/stale edits and retried creation cannot silently duplicate/overwrite; menu/location mutations roll back if audit fails; inactive/invalid court links require correction; mobile/desktop bilingual UI and network failures verified. Cart, orders, payments, queues and employee-account administration are excluded.

No Milestone 3 authorization is implied.
