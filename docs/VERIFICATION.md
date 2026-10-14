# Milestone 1 verification — 2026-10-14

**Result:** Foundation acceptance criteria satisfied within the approved local scope. No production connection/deployment or Milestone 2 implementation. Later MVP workflow gates remain unverified.

## Executed checks

- `npx --yes npm@11.21.0 ci`: clean lockfile installation passed.
- `npm run typecheck` and `npm run lint`: passed.
- `npm test`: 20 unit tests passed (environment isolation, disabled payments, sanitized errors and default-deny role logic).
- `npm run test:integration`: 18 tests passed against actual PostgreSQL 17.11 with non-superuser database owners. Includes constraints, transaction rollback, environment marker rejection, production-tool rejection, real password authentication, current roles, forged/unauthenticated access, registration/origin denial, 16 simultaneous login attempts (10 processed, 6 throttled), absolute/idle expiry, logout, disabling and concurrent disable/session creation.
- `npm run test:e2e`: 5 Chromium tests passed. Includes direct API role-injection denial, cookie attributes, replay after logout, browser idle/disable behavior and actual Docker test-database pause/unpause with sanitized readiness `503`, working liveness and recovery to `200`.
- `npm run build`: passed. `npm run start` ran locally with development configuration; sign-in returned `200` and readiness returned `ready`. Normal `npm run dev` startup/readiness also passed.
- Migrations applied to newly empty test PostgreSQL and both local development databases used during setup; reruns passed without adding migrations. Final test suite confirms exactly two migration-history entries.
- `npm audit`: zero reported vulnerabilities after removing the vulnerable Next lint dependency chain and overriding the legacy Drizzle Kit loader's esbuild dependency. This is an advisory check, not a security certification.
- Generated-secret scan: no local generated database/auth credentials found in source or client JavaScript bundles; ignored environment files have restricted permissions.
- Mobile sign-in screenshot inspected at 390×844: labels/buttons readable, no horizontal overflow.
- Diff/whitespace review passed. Next.js automatic agent-file mutation disabled; `AGENTS.md` is unchanged from the owner-maintained baseline.

Initial dependency-resolution/native-binding and logout-format failures were corrected and the affected suites rerun. Local bootstrap-role initialization was corrected to use a separate normal application owner; final PostgreSQL role checks and browser tests pass.

## Not executed / remaining limits

No required Milestone 1 test remains blocked. Production HTTPS/proxy configuration, external services, production account provisioning, additional browser/device workflows, real payments and production backups/recovery are outside this milestone and were not validated.

Security/reliability boundaries: production account lifecycle/recovery/MFA and distinct runtime/migration credentials remain launch decisions. Login requests currently share a conservative persistent fallback bucket because proxy headers are not trusted. Idle expiry counts explicit activity, not passive polling. Revocation prevents subsequent access; already-authorized in-flight work is not retroactively undone. Use patched supported Node 22 and keep dependency/advisory checks current.

Local database containers remain healthy; verification application servers were stopped. The current development volume is `lisi-foundation_dev-data-v2`; the original volume was retained, not erased. Generated local configuration and the inspection screenshot are ignored and must not be committed.

## Files

Modified: `SCOPE.md`, `docs/DECISIONS.md`, `docs/WORKFLOWS.md`, `docs/RELIABILITY.md`, `docs/ACCEPTANCE.md`.

Created configuration: `package.json`, `package-lock.json`, `.gitignore`, `.nvmrc`, `.env.example`, `.env.production.example`, `compose.yaml`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `drizzle.config.ts`, `vitest.config.ts`, `playwright.config.ts`.

Created documentation: `README.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/implementation-plan.md`, `docs/decisions/001-foundation.md`, `docs/OPEN_QUESTIONS.md`, this verification report.

Created migrations: `drizzle/0000_woozy_hydra.sql`, `drizzle/0001_session_policy.sql`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/0001_snapshot.json`, `drizzle/meta/_journal.json`.

Created scripts: `scripts/setup-local.ts`, `scripts/run.ts`, `scripts/database-safety.ts`, `scripts/migrate.ts`, `scripts/provision.ts`, `scripts/disable.ts`, `scripts/postgres-init.sql`.

Created server modules: `src/server/config.ts`, `src/server/db/client.ts`, `src/server/db/schema.ts`, `src/server/auth.ts`, `src/server/auth-http.ts`, `src/server/employee.ts`, `src/server/roles.ts`, `src/server/provisioning.ts`, `src/server/http.ts`, `src/server/health.ts`.

Created application routes/UI: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/employee/sign-in/page.tsx`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/employee/me/route.ts`, `src/app/api/employee/activity/route.ts`, `src/app/api/admin/health/route.ts`, `src/app/api/health/live/route.ts`, `src/app/api/health/ready/route.ts`.

Created tests: `tests/server-only.ts`, `tests/database.ts`, `tests/unit/config.test.ts`, `tests/unit/http.test.ts`, `tests/integration/foundation.test.ts`, `tests/e2e/foundation.spec.ts`.

See `README.md` for exact setup, provisioning, verification and local startup commands. No commit or push was performed.
