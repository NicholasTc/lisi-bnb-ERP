# Milestone 2 verification — 2026-10-15

**Result:** Approved local menu/location acceptance criteria satisfied. Milestone 3, ordering, payments, operational queues, production provisioning and deployment have not started.

## Delivered

- Mobile-first customer menu at `/`, with Bahasa Indonesia/English switching, persistent language preference, search/category filters, exact inclusive IDR prices and unavailable labels. Optional owner-entered English translations fall back to original content.
- Owner menu/directory editing at `/employee/menu`; preparation staff can change availability only. Buildings, courts and numbered tables start empty. No fabricated development menu/location data was added.
- Stable court destination links preselect an active court in an active building, require explicit confirmation and permit override. Invalid/inactive/table-ID links require correction. This is location preview, not an order; QR image/print generation remains future work.
- Server-side input, origin and current-session/role checks; bounded JSON bodies. Database price/name/parent/table/uniqueness constraints, version conflicts, stable creation IDs, archive/inactivation and atomic actor/before/after audit records.
- No new dependencies or services. Existing architecture and authentication/session policy retained.

## Executed verification

- `npm test`: **28 passed** across four files.
- `npm run test:integration`: **29 passed** across two files, including foundation regressions, actual PostgreSQL constraints/permissions, concurrent stale edits, repeat creation, audit-write failure rollback, archive visibility and QR/location checks. Passed again after initializing the disposable test database from empty.
- `npm run test:e2e`: **11 passed** in the final packaged-app run. Includes owner item/price/directory changes, preparation-only availability, language preference, public search/filters, court confirmation/override/inactivation, simultaneous browser drafts and explicit public/staff service failures, plus foundation authentication/revocation/permission checks and actual PostgreSQL pause/recovery.
- `npm run typecheck`, `npm run lint`, normal `npm run build` and the final test-configured optimized build: passed. Browser tests execute the packaged app with `APP_ENV=test`; this does not connect to production.
- Reviewed `0002_grey_garia.sql`; applied to development and freshly empty disposable test PostgreSQL. All three migrations present; development rerun succeeded without duplicate migration entries.
- Inspected customer screenshots at 390×844 and 1280×900; mobile horizontal-overflow assertion passed. Screenshots use synthetic test fixtures and live only in ignored `.local/`.
- Running development customer page returned HTTP 200 and readiness returned `ready`.
- Diff/whitespace review passed. `AGENTS.md`, `docs/project-log.md` and `docs/STARTUP.md` preserved. No commit, push or public deployment.

Initial browser failures exposed ambiguous select labels, assertions matching Next's route announcer, a shared development-build lock and generated-type watcher reloads. Corrected labels/assertions and isolated test output; final browser execution builds/starts the packaged app instead of a second development watcher. One intermediate rerun also timed out during test-account setup; the final complete run passed without increasing timeouts or bypassing security. Lint ignores generated `.next-test` output while retaining source checks.

## Files

Created:
- Catalog: `src/catalog/types.ts`, `src/catalog/copy.ts`, `src/server/catalog.ts`, `src/server/catalog-input.ts`, `src/server/request-body.ts`.
- Customer UI: `src/components/customer-menu.tsx`, `src/components/court-art.tsx`, `src/app/menu.css`.
- Staff UI: `src/components/staff-catalog.tsx`, `src/app/employee/menu/page.tsx`, `src/app/employee/menu/staff.css`.
- Routes: `src/app/api/catalog/route.ts`, `src/app/api/employee/catalog/route.ts`, `src/app/api/employee/catalog/[entity]/route.ts`.
- Migration: `drizzle/0002_grey_garia.sql`, `drizzle/meta/0002_snapshot.json`.
- Tests: `tests/unit/catalog-input.test.ts`, `tests/unit/request-body.test.ts`, `tests/integration/catalog.test.ts`, `tests/e2e/catalog.spec.ts`.
- Test runtime: `scripts/e2e-server.ts`, `tsconfig.e2e.json`.
- Documentation: `docs/decisions/002-catalog.md`, this report.

Modified:
- Application/database: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/employee/sign-in/page.tsx`, `src/server/db/schema.ts`, `src/server/health.ts`, `drizzle/meta/_journal.json`.
- Tooling/regressions: `.gitignore`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `scripts/run.ts`, `tests/database.ts`, `tests/integration/foundation.test.ts`, `tests/e2e/foundation.spec.ts`.
- Documentation: `README.md`, `SCOPE.md`, `docs/DECISIONS.md`, `docs/WORKFLOWS.md`, `docs/ACCEPTANCE.md`, `docs/OPEN_QUESTIONS.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/implementation-plan.md`.

## Try it locally

For the existing setup:

```sh
docker compose --env-file .local/docker.env up -d --wait
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:3000. To edit, sign in at `/employee/sign-in` with an owner account, then select **Manage menu & locations**. Add menu items and a building before adding courts/tables. The customer menu updates on refresh (also polls once per minute).

If you need a new local owner account:

```sh
npm run employee:provision -- owner@example.invalid "Local Owner" owner
```

Use your own unique email and a unique 12–128 character password at the hidden prompt. Existing accounts are not overwritten or granted extra roles. Production provisioning remains unavailable. If port 3000 already serves this project, use that running app rather than starting a duplicate.

## Limits / remaining gates

No required Milestone 2 check remains blocked. Browser coverage is Chromium only; real device/Safari testing, production security/proxy/account lifecycle, backup/recovery targets and real payment verification remain unvalidated future gates. No customer orders or payments can be accepted. Actual content, location entries and printed QR placement must be supplied/checked by the owner. Zero-price checkout behavior and remaining order/payment rules must be decided before Milestone 3.
