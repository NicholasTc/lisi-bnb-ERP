# LISI BNB ERP — Foundation

Milestone 1 only. Employee authentication, database/environment isolation, health checks and test tooling. Ordering, all payments and dashboards are absent. No production deployment or provisioning.

## Requirements

- Supported, patched Node.js 22 LTS (minimum 22.18; `.nvmrc` selects the 22 line).
- npm 11.21.0 for dependency installation; earlier npm 11.5.2 failed peer resolution during setup. `npx` below uses the pinned version without modifying the global installation.
- Running Docker Desktop with Docker Compose.

## Local setup

```sh
npx --yes npm@11.21.0 ci
npm run local:setup
docker compose --env-file .local/docker.env up -d --wait
npm run db:migrate
npm run db:migrate:test
npm run employee:provision -- employee@example.invalid "Local Employee" preparation,delivery
npm run dev
```

Provisioning prompts for a password with input hidden. Use a unique 12–128 character password; do not pass it as a command argument or commit it. The displayed employee ID can be used with `npm run employee:disable -- <id>`. Add `owner` only to a local account that should access the foundation owner diagnostic.

Open http://127.0.0.1:3000. Sign in at `/employee/sign-in`. Only the exact configured origin is trusted; using `localhost` instead of `127.0.0.1` will fail origin checks.

`local:setup` creates random independent database passwords and auth secrets in ignored `.local/` files with restricted permissions; it does not overwrite existing files. Never run `docker compose config` in shared logs: it can display interpolated secrets. Existing development database credentials must match its persistent volume; do not remove that volume to fix credentials without deciding whether its data can be lost.

Development PostgreSQL binds to `127.0.0.1:55432`; disposable test PostgreSQL to `127.0.0.1:55433`. The test data directory is tmpfs and disappears when that container stops. To rebuild it, start the container and rerun `db:migrate:test`. Do not run integration and browser suites concurrently: both deliberately manage disposable test identities.

Bootstrap and application database roles have independent generated passwords. Applications/migrations use database owners without cluster-administration privileges. The active development volume is `lisi-foundation_dev-data-v2`; the original `lisi-foundation_dev-data` from initial setup was retained untouched and is not used by this configuration. No automatic volume deletion is performed.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm run start
```

`start` verifies the production build locally using development configuration; it is not a production deployment. Browser tests start their own test-configured app at `127.0.0.1:3100` and briefly pause/unpause only `db-test` to verify database interruption handling. Playwright Chromium is the milestone's browser scope; additional device/browser acceptance belongs to later workflows.

Migrations are SQL files under `drizzle/`. Generate new reviewed migrations with `npm run db:generate`; do not use schema push or modify applied migrations. Local migration tools validate both the URL target and database environment marker; production migration/provisioning procedures are deliberately unavailable.

## Environment and security boundaries

`APP_ENV` is explicit and separate from Next.js `NODE_ENV`. Server config requires `DATABASE_URL`, `APP_ORIGIN`, `BETTER_AUTH_SECRET` and `PAYMENTS_MODE=disabled`. `.env.example` and `.env.production.example` are documentation templates, not usable credentials. Local runners load only the corresponding `.local/development.env` or `.local/test.env`; unsafe targets and marker mismatches fail closed.

Production requires a separate encrypted database connection, HTTPS and a secret supplied externally. Production configuration is validated in unit tests with synthetic values only. No production connection or owner provisioning is performed.

Employee registration and unapproved Better Auth routes are closed. Roles and sessions are checked server-side on each protected request. Database-backed sessions have eight-hour absolute expiry, no refresh, thirty-minute inactivity expiry and no cookie session cache. Explicit user activity refreshes only the idle timestamp; background polls cannot extend access. Logout/disabling invalidate subsequent requests, including replayed cookies; already-authorized in-flight work cannot be retroactively undone.

Login throttling is persistent and atomic through the reviewed Better Auth/Drizzle implementation. No proxy/IP headers are trusted in this local foundation, so logins share a conservative fallback bucket (10 attempts per minute). Review production proxy trust and per-account protections before launch. Secrets/tokens/raw database errors are omitted from logs; server failure denies access.

`/api/health/live` returns process availability; `/api/health/ready` returns availability only when required migrations and the environment marker are present. Owner-only `/api/admin/health` demonstrates authorization without adding operational administration.

Dependency pins include Vitest 4/Vite 7 for compatible native test tooling and an esbuild override for Drizzle Kit's legacy loader. ESLint 10 with TypeScript/React Hooks rules avoids the vulnerable Next lint glob chain; Next-specific plugin rules are not enabled. Recheck the override and advisories when updating tools. See [architecture](docs/architecture.md), [data model](docs/data-model.md), [open questions](docs/OPEN_QUESTIONS.md) and [verification](docs/VERIFICATION.md).
