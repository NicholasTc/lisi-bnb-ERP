# LISI BNB ERP

**Current local milestone — V2-1 (2026-10-16):** Court-only guest checkout now saves unpaid preparation eligibility, with a simpler bilingual menu/cart/status and no automatic cancellation. See [V2-1 verification](docs/VERIFICATION-V2-1.md) and [updated milestones](docs/implementation-plan.md). Employee queues/claims/delivery, payment collection/verification and reporting are not implemented yet. Payment verification is explicitly blocked pending merchant review. Production and real-customer use remain unavailable. Existing demo orders remain isolated historical records.

For an existing local setup, run `npm run db:migrate` and `npm run db:migrate:test`, then restart `npm run dev`. Open `http://127.0.0.1:3000/`. As owner, configure a real building/court in `/employee/menu` if none exists; no fabricated locations are seeded. New court ordering works locally with payments disabled and does not require `demo:enable`. Never transfer real money during this test. Preserve existing private links; new court orders no longer use demo payment controls.

## Historical v1 setup and tooling

The section below retains initial setup/test commands. Its demo checkout/counter/payment-control descriptions are v1 history, superseded by the current milestone above; counter/pickup/dine-in are deferred to Phase 2.

Milestones 1–3: foundation, bilingual menu/location management, guest/counter ordering, private order recovery and isolated simulated payments/refunds. No real payments, fulfillment execution, operational dashboards, production deployment or production provisioning.

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
npm run demo:enable
npm run employee:provision -- employee@example.invalid "Local Employee" preparation,delivery
npm run dev
```

Provisioning prompts for a password with input hidden. Use a unique 12–128 character password; do not pass it as a command argument or commit it. The displayed employee ID can be used with `npm run employee:disable -- <id>`. Add `owner` only to a local account that should access the foundation owner diagnostic.

Open http://127.0.0.1:3000. Sign in at `/employee/sign-in`. Only the exact configured origin is trusted; using `localhost` instead of `127.0.0.1` will fail origin checks.

Menu and directory start empty. To manage them, provision a local **owner** account with the same command above using `owner` instead of `preparation,delivery`, sign in, then open `/employee/menu`. Use your own unique email; existing accounts are never overwritten or silently granted extra roles. Preparation accounts can toggle availability but cannot change prices or directory entries. Account administration UI remains a later milestone.

Owners enter final inclusive IDR prices, optional English translations, buildings, courts and numbered tables. A court's displayed destination link (`/?court=<id>`) is the URL to encode in its ordering QR; image/print generation is not included yet. Customers use ID/EN, add items to their cart and checkout for court delivery, pickup or dine-in. See [Milestone 2 verification](docs/VERIFICATION-M2.md) and [Milestone 3 verification](docs/VERIFICATION-M3.md).

## Demo ordering

For an existing setup, run `npm run db:migrate`, `npm run db:migrate:test` and `npm run demo:enable`, then restart `npm run dev`. The enable command validates and edits only ignored local development/test configuration, generates independent signing secrets and preserves existing database/auth secrets. It never enables a real provider. Fresh `local:setup` still defaults payments to disabled until this explicit command.

- Customer checkout: `/checkout`; private status: `/orders/<id>#<private-key>`. Save the recovery link; never put it or passwords in source/documentation/screenshots. The browser can reopen recent orders for 24 hours. Court orders require name, phone and explicit location confirmation; pickup/dine-in require name and their relevant destination. Only positive-price items are orderable.
- Counter entry: sign in as `counter` or `owner`, then `/employee/counter`. To create a new local counter identity, use the provisioning command with role `counter`; no account-management UI exists yet.
- Demo test controls: owner/supervisor sign-in, then `/employee/demo-payments`. Refresh/select an order, simulate payment, store evidence without delivery, replay it or reconcile undelivered events. Only these authorized controls can supply simulated success; customers cannot mark themselves paid.
- Refunds: enter a reason and request a full simulated refund against a recorded payment. Resolve its outcome using the test controls; leave unknown outcomes pending and retry the same command after uncertain network results. Refunding an extra payment does not cancel the original accepted order.
- A successful demo payment records preparation eligibility only. No kitchen/delivery task execution or real merchant payment is implied. All prices/amounts/history shown here are simulated where payments are involved.

Five reviewed migrations are required. Development/test data stay separate; integration/browser tests reset only disposable test records. Production rejects demo mode and all ordering/demo endpoints in this milestone, even with forged direct requests. See [confirmed ordering rules](docs/decisions/003-ordering-proposal.md) and the [manual test guide](docs/TESTING-M3.md).

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

`start` verifies the production build locally using development configuration; it is not a production deployment. Browser tests build/start a separate packaged app at `127.0.0.1:3100` using isolated test configuration and `.next-test` output, and briefly pause/unpause only `db-test` to verify database interruption handling. Keep integration and browser suites sequential. Playwright Chromium is the milestone's browser scope; additional device/browser acceptance belongs to later workflows.

Migrations are SQL files under `drizzle/`. Generate new reviewed migrations with `npm run db:generate`; do not use schema push or modify applied migrations. Local migration tools validate both the URL target and database environment marker; production migration/provisioning procedures are deliberately unavailable.

## Environment and security boundaries

`APP_ENV` is explicit and separate from Next.js `NODE_ENV`. Server config requires `DATABASE_URL`, `APP_ORIGIN`, `BETTER_AUTH_SECRET` and explicit `PAYMENTS_MODE=disabled` or non-production `demo`. Demo mode additionally requires an independent `DEMO_PAYMENT_SECRET`. Production permits only disabled payments until real integration approval. `.env.example` and `.env.production.example` are documentation templates, not usable credentials. Local runners load only the corresponding `.local/development.env` or `.local/test.env`; unsafe targets and marker mismatches fail closed.

Production requires a separate encrypted database connection, HTTPS and a secret supplied externally. Production configuration is validated in unit tests with synthetic values only. No production connection or owner provisioning is performed.

Employee registration and unapproved Better Auth routes are closed. Roles and sessions are checked server-side on each protected request. Database-backed sessions have eight-hour absolute expiry, no refresh, thirty-minute inactivity expiry and no cookie session cache. Explicit user activity refreshes only the idle timestamp; background polls cannot extend access. Logout/disabling invalidate subsequent requests, including replayed cookies; already-authorized in-flight work cannot be retroactively undone.

Login throttling is persistent and atomic through the reviewed Better Auth/Drizzle implementation. No proxy/IP headers are trusted in this local foundation, so logins share a conservative fallback bucket (10 attempts per minute). Review production proxy trust and per-account protections before launch. Secrets/tokens/raw database errors are omitted from logs; server failure denies access.

`/api/health/live` returns process availability; `/api/health/ready` returns availability only when required migrations and the environment marker are present. Owner-only `/api/admin/health` demonstrates authorization without adding operational administration.

Dependency pins include Vitest 4/Vite 7 for compatible native test tooling and an esbuild override for Drizzle Kit's legacy loader. ESLint 10 with TypeScript/React Hooks rules avoids the vulnerable Next lint glob chain; Next-specific plugin rules are not enabled. Recheck the override and advisories when updating tools. See [architecture](docs/architecture.md), [data model](docs/data-model.md), [open questions](docs/OPEN_QUESTIONS.md) and [verification](docs/VERIFICATION.md).
