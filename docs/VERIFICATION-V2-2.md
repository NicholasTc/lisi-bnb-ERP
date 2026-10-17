# V2-2 preparation — verification

**Executed 2026-10-17. Status:** implemented and automated local checks passed; owner human/device acceptance pending. No production/pilot/V2-3 authorization. Rules: [decision 006](decisions/006-preparation.md).

## Delivered and architecture

Court orders move from New to Preparing to Ready, or enter a reasoned review hold. Preparation/owners work; supervisors view unless also preparation. One durable assignee, actor-bound idempotent commands and atomic audit/history protect concurrent/retried actions. Guest cancellation competes on the same order lock and stops at claim. Persistent versioned pauses stop fresh checkout while existing work and committed-checkout retries continue. Preparation never records money or handover.

The existing modular monolith/authentication/database remain. No new dependencies/infrastructure. Server-side session/role/assignee checks and input/origin/body limits protect the new API. Staff DTOs omit contact/recovery/payment data; guest responses omit internal review reasons. Replay cannot bypass 24-hour private access. ID/EN task UI follows existing branding, with polling, manual refresh, stale action blocks, optional gesture-enabled sound and employee-scoped uncertain-action recovery. Production operations remain closed.

## Files

Created:

- `src/server/preparation.ts`, `preparation-input.ts`; `src/preparation/types.ts`, `copy.ts`.
- `src/app/api/employee/preparation/route.ts`; `src/app/employee/preparation/page.tsx`, `preparation.css`; `src/components/preparation-queue.tsx`.
- `drizzle/0007_preparation.sql`, `drizzle/meta/0007_snapshot.json`; new preparation unit/PostgreSQL/browser test files.
- `docs/decisions/006-preparation.md` and this evidence file.

Modified:

- Order/schema/catalog/readiness services, shared catalog/order types and bilingual copy; customer checkout/menu/status; staff catalog navigation, employee sign-in links and logout draft cleanup.
- Migration journal, isolated test cleanup and foundation/catalog regression expectations.
- README, scope, startup, implementation plan, decisions, workflows, reliability, acceptance, architecture, data model and open questions. AGENTS.md/project-log.md, dependency manifests and original startup notes preserved. No historical migration edited.

## Executed checks

- `npm test`: **35 passed**, six files.
- `npm run test:integration`: **69 passed**, five files, real isolated PostgreSQL. Includes exclusive/concurrent claims, assignee/role/session denial, cancel race, replay after later progress, review/pause rules, pause/checkout race, audit-failure rollback, database history/transition constraints, pagination beyond 50 with microsecond timestamps, private-access expiry, production denial and original financial/catalog/auth regressions.
- `npm run test:e2e`: **27 Chromium tests passed**, including seven preparation scenarios. Covers full customer checkout → owner claim → customer preparing → ready/unpaid; lost committed claim response and reload retry; two staff claiming; pause/resume and review holds; idle expiry redaction and supervisor view; stale connection blocking/recovery; new arrivals despite blocked audio. Existing customer, historical simulator and authentication regressions pass. This command also builds/starts the packaged isolated Next.js application successfully.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run db:migrate:test`: all **eight migrations applied to an empty, identity-checked disposable test database**; immediate rerun passed. No development reset.
- `npm run db:migrate`: upgraded existing development database. Before/after counts and SHA-256 fingerprints match for all **14 existing business/auth tables**, excluding only the newly added null task columns from comparison. No account, menu, destination, order or financial history changed.
- `npm run test:dev`: passed against the user's existing development server on `127.0.0.1:3000`; menu loads/refreshes, language persists, no repeated navigation/fetch loop or JavaScript errors. The user's server was not restarted/stopped. Temporary browser-test server on 3100 stopped after the suite.
- Visual inspection: generated 390px and 1280px preparation screenshots; all mobile tabs visible, no page overflow. `git diff --check`: passed. Generated Next test imports restored to original development configuration.

## Human checks and limitations

Still required: owner review on actual café/customer devices, physical sound audibility/browser background/sleep behavior, approved production freshness/escalation/capacity targets, shift recovery/backup restore drills and production permissions/provisioning review. Polling every 5 seconds and stale blocking at 15 seconds are provisional local engineering settings, not production service guarantees. Optional sound is supplementary and not a durable notification promise.

Ready orders intentionally stop awaiting the later delivery workflow. Review holds cannot yet be resolved/reassigned through this stage; no automatic release/cancellation or paid-status bypass exists. Merchant access, evidence fields and timing remain unconfirmed; payment verification must not be implemented before that review. No real money, public deployment, sales-reporting or production recovery acceptance was tested or claimed.

## Test locally

The development migration is already applied here. With local PostgreSQL running, start or restart manually if needed:

```sh
npm run dev
```

Open `http://127.0.0.1:3000/`, submit a court order and keep its status page open. In a separate browser/profile, sign in at `http://127.0.0.1:3000/employee/sign-in` with the existing owner account and choose **Preparation queue**. Claim the order, then mark ready; the customer page follows on successful polling. Use real preparation only as a controlled test; do not send real payment. Test pause/review optionally, remembering review resolution comes in V2-3.

**Gate result:** automated V2-2 criteria satisfied locally; human acceptance pending. Stop here before V2-3.
