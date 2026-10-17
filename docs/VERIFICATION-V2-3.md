# V2-3 delivery, recovery and Team — verification

**Executed 2026-10-17. Status:** implemented; local automated checks passed. Owner human/device acceptance is pending. No V2-4, real-money or deployment approval. Approved rules: [decision 007](decisions/007-delivery-and-team.md).

## Delivered

- Delivery/owners claim ready court orders exclusively, record collection and arrival, and see contact details only for their assigned deliveries. Customer status follows delivery progress. Ordinary payment confirmation/completion remains unavailable.
- Staff hold their own interrupted delivery with a reason. Absent/refused incidents require a contact attempt. Collected drinks must return before cancellation. Owners/supervisors resume, reassign, correct an active court, cancel or explicitly record an exceptional unpaid handover after a reasoned physical check. Unpaid exceptions create no payment or invented monetary loss.
- Returned retry moves to **Awaiting collection** under an eligible assignee and requires collection again. Previous claim/collection/arrival/return timestamps remain in immutable command history. Corrections preserve the original destination and appear in preparation, delivery and customer views.
- Delivery pause persists across restarts and blocks fresh court submissions/claims; existing assigned work continues. Preparation and delivery pauses remain separate.
- Owner Team management lists/counts/searches employees, creates individual accounts with temporary passwords, assigns multiple roles and edits/disables access. New employees must replace their temporary password before accessing staff tools. Changes revoke sessions; tasks/history remain for supervised recovery. The last enabled owner with completed password setup is protected.

## Architecture and safeguards

The approved modular monolith, PostgreSQL, ORM and Better Auth remain; no new dependency, hosting or infrastructure was added. Two additive migrations introduce account policy/history and delivery/recovery state. Current session/role/assignee checks run inside task/account transactions; order versions reject stale recovery decisions. Actor-bound command identities make committed-response loss/retry safe. State changes and immutable history commit together; database guards enforce physical-stage/timestamp consistency.

Password setup uses the installed Better Auth hash/verify primitives. Password, first-login flag, audit and session revocation change atomically, followed by fresh sign-in. No custom session-token system, email service, public registration, account deletion or password retrieval/reset is added. Team changes retain credentials only in transient form/request memory; full-reload creation uncertainty is resolved by searching the unique email. Non-secret operation retries persist per employee in session storage. Production account/delivery APIs remain closed.

The ID/EN staff UI follows the existing bright branding, with task-focused next actions, empty/loading/error states, polling/manual refresh and stale-action blocking. Polling is passive; user interaction renews activity within the existing eight-hour absolute/30-minute inactivity policy.

## Files created or modified

Created:

- `src/server/team.ts`, `operations.ts`, `operation-input.ts`; `src/team/types.ts`, `src/operations/types.ts`.
- `src/app/api/employee/team/route.ts`, `password/route.ts`, `operations/route.ts`.
- `src/app/employee/team/page.tsx`, `team/team.css`, `delivery/page.tsx`, `delivery/delivery.css`, `password/page.tsx`.
- `src/components/team-management.tsx`, `delivery-queue.tsx`, `password-change.tsx`, `staff-frame.tsx`, `use-employee-screen.ts`.
- `drizzle/0008_employee_management.sql`, `0009_delivery_recovery.sql`, and matching metadata snapshots.
- `tests/integration/team.test.ts`, `operations.test.ts`; `tests/e2e/delivery-team.spec.ts`; `tests/unit/operation-input.test.ts`.
- `docs/decisions/007-delivery-and-team.md` and this evidence file.

Modified:

- Employee authorization/self-metadata/sign-in; schema/readiness; order/catalog/preparation services, shared order/preparation types/copy and customer status; preparation navigation and logout draft cleanup.
- Migration journal, disposable database cleanup, foundation migration expectation and preparation browser status expectation.
- README, scope, decisions, workflows, reliability, acceptance, architecture, data model, implementation plan, open questions and a current-stage prefix in `docs/STARTUP_AND_ACCOUNTS.md`.

Preserved the user's startup-file rename and original notes byte-for-byte beneath that prefix. AGENTS.md, project-log.md, dependency manifests and all previously existing migrations/snapshots remain unchanged relative to the start of V2-3. Preexisting V2-2 modifications were retained; generated Next test imports were restored to the original development configuration.

## Executed checks

- `npm test`: **36 passed**, seven files.
- `npm run test:integration`: **92 passed**, seven files, real isolated PostgreSQL. Coverage includes competing delivery claims/pause decisions; replay after later progress; former/disabled-assignee denial; privileged recovery/version conflicts; contact/return/correction and recollection; unpaid handover without money; creation/password audit rollback; mandatory setup; normalized duplicate identities; immediate session revocation; concurrent last-owner protection; forged input/origin denial; production denial; existing ordering/preparation/catalog/auth/demo regressions.
- `npm run test:e2e`: **34 Chromium tests passed**, including seven delivery/Team tests. Exercises account creation → mandatory password replacement → delivery access → disable/revocation; last-owner/mobile layout; lost creation/claim responses and retry; customer delivery progress; supervised preparation recovery; explicit unpaid-handover confirmation; returned-drink retry requiring collection. Existing workflows passed. The suite successfully built and ran the packaged Next.js application on isolated test port 3100.
- `npm run typecheck` and `npm run lint`: passed. An initial browser check exposed an imprecise select label; explicit bilingual accessible names were added, then the complete suite passed. Review also corrected preparation's display of an authorized court correction and added regression coverage.
- `npm run db:migrate:test`: all **ten migrations applied fresh** to the identity-checked disposable database; immediate reapplication passed. Integration/browser tests then passed against that schema.
- `npm run db:generate`: **no schema changes**; migration metadata agrees with the implemented schema.
- `npm run db:migrate`: development upgraded without resetting data. Before/after row counts and SHA-256 fingerprints match for **16 existing business/auth tables**, excluding only the columns newly added by these migrations. Existing credentials, menu, orders, locations and financial history were preserved.
- `npm run test:dev`: passed against the user's already-running `127.0.0.1:3000` server; menu loads, language persists, refresh works, and no repeated navigation/fetch loop or browser JavaScript errors occurred. The server was not stopped/restarted; this smoke check creates no fixtures.
- Visual review: 390px Team/delivery screens and desktop supervised-return recovery; mobile browser checks found no page overflow. `git diff --check` passed. The temporary test server stopped after the suite.

## Remaining limits and unrun acceptance

Owner testing on actual café devices, shift/physical recovery exercises, background/sleep behavior, production capacity/abuse tuning and freshness/escalation targets remain pending. Five-second polling and 15-second stale blocking are local test settings, not production guarantees. No real-money, actual merchant, production permissions, backup restore or public pilot testing was performed.

Merchant access, usable payment evidence and confirmation timing remain unconfirmed. Payment verification, ordinary paid handover/completion and reporting are not implemented by this stage. Production owner bootstrap/password recovery, least-privilege deployment and operational launch procedures remain separate gates. No prepared-drink safety or retry waiting-time policy is invented; supervisors must physically assess returned work before retrying.

## Local human test

Development migrations are already applied here. With local PostgreSQL running, start manually if needed:

```sh
npm run dev
```

1. Open `http://127.0.0.1:3000/` in a customer browser, submit a court order and keep its private status page open.
2. In another browser/profile, sign in with your existing owner at `http://127.0.0.1:3000/employee/sign-in`. Choose **Preparation queue**, claim and mark ready.
3. Choose **Delivery & recovery** (or `/employee/delivery`), claim the ready order, collect it and record arrival. Check customer progress. Stop at awaiting payment/handover; do not send real money.
4. Optional recovery test: report an absent customer with contact details, record the actual return to café, then use **Supervised recovery → Retry delivery — collect again** with a reason/physical check. Collection must be recorded again.
5. Choose **Team & accounts** (or `/employee/team`), create a delivery employee with a private temporary password, then sign in separately and replace it. Disable that test account from Team and confirm existing access ends.

**Gate result:** local automated V2-3 criteria satisfied; owner human acceptance pending. Stop before V2-4. Confirm merchant operations and obtain approval before payment-verification implementation.
