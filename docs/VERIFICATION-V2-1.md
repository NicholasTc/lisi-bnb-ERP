# V2-1 verification — 2026-10-16

**Result:** Court-ordering implementation and automated checks passed; ready for owner UI/human acceptance. **Phase 1 is not complete.** V2-2 preparation claims, delivery, manual payment verification/collection, sales reporting and launch gates have not been implemented/accepted.

## Implemented and architectural choices

- Brighter, compact bilingual app-style menu, persistent cart, court-only checkout and private confirmation/status. A valid court QR opens a compact location summary; checkout still requires explicit confirmation. Order/recovery details are disclosed progressively. Agent visually inspected menu, checkout and status screenshots; owner acceptance remains pending.
- Submitted local court orders immediately retain unpaid `awaiting_preparation` eligibility, no automatic cancellation and no payment deadline. Unique display reference, exact immutable price/destination snapshots, 24-hour private access, durable retries and creation/cancellation audit remain. This is stored eligibility, not an implemented employee queue/claim.
- Existing v1 demo records/services remain isolated. New court checkout works with payments disabled; production ordering remains unavailable. Counter/pickup/dine-in creation and navigation are deferred; no records were deleted. Demo evidence cannot pay a new court order at service/database boundaries. No manual payment-proof fields or mark-paid workaround were implemented.
- New migrations retain v1 constraints/history and add the court test boundary. Migration review caught an unintended nullable session expiry after 0005 was test-applied; 0006 corrects it without rewriting that applied migration. Final schema requires employee session expiry and permits absent payment deadlines only for court-test orders; PostgreSQL regression checks cover this.
- Private-link fragment changes clear the former view, never fall back to a saved good key when a supplied key is bad, and invalidate late status/cancel responses. Polls do not overlap or supersede a pending cancellation. Original technical cart/throttle limits are retained for local testing, not validated production capacity.

## Executed checks

- `npm test`: **33 unit tests passed**.
- `npm run test:integration`: **55 PostgreSQL tests passed** across four files, including nine new court tests plus foundation/catalog/v1 financial regressions. Repeated successfully after restarting the disposable tmpfs database and applying/rerunning all seven migrations.
- `npm run test:e2e`: **20 Chromium tests passed** against a separately built/started packaged test application. Includes committed-response loss/retry, explicit changed-price review, required court confirmation, deferred modes, private-key changes with delayed cancellation, role/payment boundaries, mobile/desktop layout and historical demo payment/refund regressions.
- `npm run typecheck`, `npm run lint` and `npm run build`: passed. Packaged browser builds also passed.
- `npm run db:migrate:test` and repeated rerun: passed; `npm run db:migrate` upgraded development to seven migrations.
- Secret-free hashes/counts before/after development migration match every existing row in 14 checked account/catalog/order/financial/audit tables, excluding only the newly added null reference column. Preserved two employees, one menu item, two old orders and all existing financial history. No test fixtures were inserted into development.
- Restarted local development app; `/api/health/ready` returned `ready`, `/api/catalog` returned ordering enabled and preserved menu content. Development has no buildings/courts yet. User-owned `AGENTS.md`, `docs/STARTUP.md`, `docs/project-log.md`, package manifests and environment templates were unchanged.

## Limits and required next acceptance

No implemented test was skipped because of a tooling blocker. Initial browser failures found an explicit-label issue, a legacy fixture missing its required description and stale same-order private-link handling; corrected and final suite passed. Physical devices, Safari, production traffic and backups/one-hour recovery targets remain unverified. Agent screenshot review is not owner usability approval.

Actual preparation claiming/cancel races, task progress, delivery, payment collection/verification, reconciliation/reporting and full recovery are later milestone gates. Merchant access/evidence/timing remain OPEN; do not implement payment verification until reviewed. No real funds moved, gateway/deployment was added, or production system was contacted. Unpaid exception authority does not bypass that gate. Existing local global throttles, indefinite queue aging and 24-hour links need operational/retention review before pilot.

## Local review commands

For an existing setup:

```sh
docker compose --env-file .local/docker.env up -d --wait
npm run db:migrate
npm run db:migrate:test
npm run dev
```

Open `http://127.0.0.1:3000/`. The development server was restarted for review. Do not start a second server on the same port. New court ordering does not require demo payments enabled. Owner adds the actual building/court in `/employee/menu` before checkout. Follow [short human checks](TESTING-V2-1.md). Stop for V2-1 acceptance/next-milestone approval; V2-2 is not started.

## Files created or modified in this milestone

The repository already contained uncommitted earlier work. This list is relative to the start of V2-1, not a claim that every Git working-tree change belongs to this milestone.

**Modified:**

- `src/app/menu.css`
- `src/app/ordering.css`
- `src/catalog/copy.ts`
- `src/server/demo-payments.ts`
- `src/server/orders.ts`
- `src/server/payment-processing.ts`
- `src/server/health.ts`
- `src/server/order-db.ts`
- `src/server/catalog.ts`
- `src/components/customer-menu.tsx`
- `src/components/order-shell.tsx`
- `src/components/demo-payments.tsx`
- `src/components/checkout.tsx`
- `src/components/order-status.tsx`
- `src/ordering/types.ts`
- `src/ordering/copy.ts`
- `src/server/db/schema.ts`
- `src/app/employee/sign-in/page.tsx`
- `src/app/employee/counter/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/app/api/employee/orders/[action]/route.ts`
- `src/app/api/orders/[action]/route.ts`
- `tests/integration/foundation.test.ts`
- `tests/integration/ordering.test.ts`
- `tests/e2e/catalog.spec.ts`
- `tests/e2e/ordering.spec.ts`
- `drizzle/meta/_journal.json`
- `docs/OPEN_QUESTIONS.md`
- `docs/architecture.md`
- `docs/implementation-plan.md`
- `docs/data-model.md`
- `docs/DECISIONS.md`
- `docs/ACCEPTANCE.md`
- `docs/decisions/004-court-first-manual-qris.md`
- `SCOPE.md`
- `README.md`

**Created:**

- `tests/integration/court.test.ts`
- `drizzle/0005_court_ordering.sql`
- `drizzle/0006_preserve_session_expiry.sql`
- `drizzle/meta/0005_snapshot.json`
- `drizzle/meta/0006_snapshot.json`
- `docs/TESTING-V2-1.md`
- `docs/decisions/005-court-ordering.md`
- `docs/VERIFICATION-V2-1.md`
