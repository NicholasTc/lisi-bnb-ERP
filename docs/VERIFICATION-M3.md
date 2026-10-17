# Milestone 3 verification — 2026-10-15

**Result:** Approved local demo-ordering acceptance criteria satisfied. Real payment processing, preparation/delivery task execution, account-management UI, production deployment and Milestone 4 have not started.

## Delivered

- Bilingual customer cart/checkout, quantities/removal, explicit review after changed prices, guest ordering without registration and court/pickup/dine-in destinations. Court delivery requires phone and explicit destination confirmation. No discounts/zero-price checkout or saved-order edits.
- Durable immutable order/item/destination/IDR snapshots, 15-minute server payment deadlines and 24-hour private guest recovery links. Link secrets are hashed on the server and travel in URL fragments/POST bodies, not HTTP URLs. Browser drafts preserve the same checkout identity after uncertain responses.
- Explicit counter role and attributed counter orders; owners can also enter counter orders. Counter staff cannot operate payment controls and can access/cancel only their own unpaid counter orders. Existing session expiry/revocation remains enforced; expired counter access clears displayed order/recovery details.
- Owner/supervisor-only demo controls: pending/success/failure/expiry, delayed/missing delivery, replay, extra payments, amount mismatches and full simulated refunds. The non-payable customer screen cannot mark itself paid. No real QRIS or merchant connection exists.
- Separate HMAC demo adapter/durable inbox and provider-independent financial transition engine. A server-only verification marker cannot be reconstructed from HTTP JSON. Source/simulation labels, event identities, payment identities and processing history remain recorded.
- Transactional serialized state changes, retry identities, immutable evidence, persistent request limits and database total/payment/refund guards. Late/mismatched/unavailable paid orders remain for review with refund default. Unknown refunds remain pending; distinct extra payments do not duplicate preparation eligibility.

## Architectural decisions

Keep the approved modular monolith and existing dependencies. Drizzle owns the schema/reviewed migrations; parameterized PostgreSQL transactions/row locks implement the financial invariants. Integer/BigInt calculations avoid floating-point money, including aggregate received/refunded amounts. No worker service, message broker, payment vendor or hosting platform was introduced.

The demo inbox commits evidence independently before common processing. Failed financial persistence rolls back payment/eligibility together, leaving the inbox visible for explicit reconciliation. Expiration uses stored database deadlines on relevant operations rather than an in-memory timer. A real adapter still needs verified provider capabilities, ID mapping, reviewed persistence/configuration extensions and real-provider tests; demo replaceability is not proof of production integration.

## Executed checks

- `npm test`: **33 tests passed** across five files. Includes exact arithmetic/overflow, configuration isolation/production demo rejection, checkout validation and inability to reconstruct a verified-evidence marker from JSON.
- `npm run test:integration`: **46 tests passed** across three files, including foundation/catalog regressions and 17 ordering/financial tests. Repeated successfully after all five migrations were applied to a freshly empty disposable PostgreSQL database.
- Integration failure cases include concurrent first checkout, immutable retry payload, current permissions, guest isolation/expiry, stale price/location/product rejection, forged signature/tampered amount, duplicate/out-of-order events, missing-event reconciliation, late success, mismatch/transaction reuse, distinct extra payments, simultaneous refund/cancel/success, unknown refund blocking, confirmed-failure retry and database snapshot/eligibility/refund constraints.
- Injected failure at financial-event persistence rolled back the payment and queued state; retained provider evidence reconciled successfully once. Invalid lookups/stale-price attempts persisted abuse counts and the checkout cap rejected excess requests.
- `npm run test:e2e`: **19 Chromium tests passed** across three files in the final packaged-app run. Eight ordering cases cover genuine checkout commit with lost response/retry (one order), private-link reopening in another browser context, reviewed price changes, court/table checkout, owner payment replay/extra refund, delayed success on canceled orders, counter attribution/permission/session expiry and guest forgery denial. Existing 11 foundation/catalog browser cases still pass, including actual test-database pause/recovery.
- `npm run typecheck`, `npm run lint`, normal `npm run build` and the packaged test build/start passed. Chromium checkout at 390×844 was inspected; horizontal overflow assertion passed. Existing menu checks also cover desktop layout. Screenshot contains synthetic checkout data and no recovery credential, and remains in ignored `.local/`.
- Reviewed `0003_illegal_gladiator.sql` and `0004_order_integrity.sql`. Applied to development and freshly empty test PostgreSQL; rerunning test migrations succeeded. Development has five migration-history entries.
- Restarted only the confirmed repository development server. Readiness returned `ready`; customer catalog returned HTTP 200 with `orderingEnabled=true`. Existing test owner remains enabled with owner permission; no development orders were seeded. Existing menu item retained; no active court/table directory entries exist yet.
- Scanned 139 application/script/test/documentation/migration/client-bundle files for generated database/auth/demo signing-secret values: no matches. Secrets stay in ignored local configuration, never in this report. Diff/whitespace review passed; `AGENTS.md`, `docs/project-log.md` and `docs/STARTUP.md` preserved. No commit, push or public deployment.

No required Milestone 3 check remains blocked.

## Files created

- Decisions/testing: `docs/decisions/003-ordering-proposal.md` (confirmed status; original filename retained), `docs/TESTING-M3.md`, this report.
- Migrations: `drizzle/0003_illegal_gladiator.sql`, `drizzle/0004_order_integrity.sql`, `drizzle/meta/0003_snapshot.json`, `drizzle/meta/0004_snapshot.json`.
- Local configuration utility: `scripts/enable-demo.ts`.
- Shared ordering/client definitions: `src/ordering/types.ts`, `src/ordering/input.ts`, `src/ordering/browser.ts`, `src/ordering/client.ts`, `src/ordering/copy.ts`.
- Server services: `src/server/order-db.ts`, `src/server/orders.ts`, `src/server/verified-evidence.ts`, `src/server/demo-provider.ts`, `src/server/demo-payments.ts`, `src/server/payment-processing.ts`.
- API routes: `src/app/api/orders/[action]/route.ts`, `src/app/api/employee/orders/route.ts`, `src/app/api/employee/orders/[action]/route.ts`.
- Pages/components: `src/app/checkout/page.tsx`, `src/app/orders/[id]/page.tsx`, `src/app/employee/counter/page.tsx`, `src/app/employee/demo-payments/page.tsx`, `src/components/checkout.tsx`, `src/components/order-shell.tsx`, `src/components/order-status.tsx`, `src/components/demo-payments.tsx`.
- Styles: `src/app/ordering.css`, `src/app/employee/demo-payments/demo.css`.
- Tests: `tests/unit/ordering.test.ts`, `tests/integration/ordering.test.ts`, `tests/e2e/ordering.spec.ts`.

## Files modified

- Configuration/schema: `package.json` (script only, no dependencies), `.env.example`, `.env.production.example`, `src/server/config.ts`, `src/server/roles.ts`, `src/server/db/schema.ts`, `src/server/health.ts`, `drizzle/meta/_journal.json`.
- Existing menu/auth UI: `src/components/customer-menu.tsx`, `src/components/staff-catalog.tsx`, `src/app/employee/sign-in/page.tsx`, `src/app/menu.css`, `src/catalog/types.ts`, `src/server/catalog.ts`, `src/server/catalog-input.ts` (canonical UUID casing).
- Regression tooling/tests: `tests/database.ts` (atomic disposable-fixture cleanup with constraints still enabled), `tests/unit/config.test.ts`, `tests/integration/catalog.test.ts`, `tests/integration/foundation.test.ts`.
- Requirements/usage: `README.md`, `SCOPE.md`, `docs/DECISIONS.md`, `docs/WORKFLOWS.md`, `docs/RELIABILITY.md`, `docs/ACCEPTANCE.md`, `docs/OPEN_QUESTIONS.md`, `docs/implementation-plan.md`, `docs/architecture.md`, `docs/data-model.md`.

Ignored `.local/development.env` and `.local/test.env` were explicitly enabled for demo mode with independent new signing secrets; existing database/auth secrets were preserved. Do not commit these files. Next's generated type imports were returned to normal development paths after build verification.

## Run / inspect locally

For an existing setup (run once when upgrading to this milestone):

```sh
docker compose --env-file .local/docker.env up -d --wait
npm run db:migrate
npm run db:migrate:test
npm run demo:enable
npm run dev
```

The development app is already running at http://127.0.0.1:3000. Use the existing owner credentials; no account reset is required. Customer checkout is `/checkout`, counter entry `/employee/counter`, owner/supervisor simulation controls `/employee/demo-payments`. Add active courts/tables through `/employee/menu` before testing those destinations. Use an available, positive-price menu item; pickup does not need a location.

Follow [five short manual checks](TESTING-M3.md). New local counter identities can be provisioned using the existing hidden-password command with role `counter`; employee administration UI remains later work. No passwords or private recovery links belong in project documentation.

## Remaining limits / risks

- Demo success is not merchant-backed payment verification. No provider authentication/capture, real refunds, settlement or gateway compatibility has been validated; these remain Milestone 6/pilot gates.
- Eligibility is persisted but no preparation/delivery tasks, handoff completion, notifications or operational dashboards run yet. Service pause/manual outage procedures and physical reassignment remain later module decisions.
- Recovery demonstrations here cover transactional rollback, replay, browser closure and test database interruption, not the production one-hour/zero-paid-detail-loss backup/restore objective.
- Browser evidence is Chromium; real mobile devices/Safari, production throughput/proxy/rate tuning, CSP/privacy/retention, staff-assisted lost-link recovery, production account provisioning and production runtime/migration privileges remain unvalidated launch requirements.
- Recovery links are capabilities: anyone holding one can access that order until expiry. Browser drafts expire logically and clean on next use; the server enforces expiry independently. No public order-number/name/phone lookup is enabled.
- The local environment is intentionally loopback-only and demo-only. No public pilot or real customer/money use is approved. Stop before Milestone 4.
