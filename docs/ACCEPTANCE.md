# LISI BNB ERP — Acceptance Criteria and Launch Gates

**Updated:** 2026-10-16. Current baseline: [MVP v2 decision](decisions/004-court-first-manual-qris.md) and [V2-1 decision](decisions/005-court-ordering.md). V2-1 automated evidence is in [VERIFICATION-V2-1.md](VERIFICATION-V2-1.md); owner UI acceptance remains pending. The complete Phase 1 gates below remain unaccepted, especially operational claims and merchant verification. No launch approval is implied.

## Phase 1 — Court acceptance

### Ordering and interface

- [ ] Customer court ordering only; counter, pickup and dine-in are outside Phase 1 acceptance and absent from its ordinary customer flow. Preserve historical records.
- [ ] Bahasa Indonesia/English mobile-first menu/cart, validated confirmed/overridden court, required name/contact, frozen inclusive integer-IDR snapshots and explicit price-change review work without registration.
- [ ] Successful submission shows a unique reference only after durable commit. A double-click, concurrent retry or lost response after commit creates exactly one order and permits authoritative recovery; failed/uncertain requests never display false success.
- [ ] Private guest access remains isolated and expires server-side after 24 hours; order/reference numbers alone do not authorize lookup. Required information remains after browser closure/application restart.
- [ ] Bright professional app-style UI uses original branding, clear primary actions and progressive disclosure. Ordinary customer/staff paths expose no raw technical state names or simulator actions. Verify agreed target phone/desktop sizes, accessible labels/contrast/targets, and loading/empty/offline/error states with owner usability review.

### Employee operations and unpaid exceptions

- [ ] An eligible court order appears once for preparation before payment; ready orders enter delivery once. B40 confirms immediate eligibility/no automatic cancellation. Approve staff aging/escalation and later task-state procedures before implementing them; the old universal 15-minute demo timeout does not apply.
- [ ] Two simultaneous preparation/delivery claims produce exactly one assignee and a clear conflict for the other. Customer cancel versus preparation claim produces one permitted outcome; cancellation after claim is rejected for the customer.
- [ ] Role/current-assignee checks reject unauthorized/direct API and former-assignee actions. Only supervisor/owner can reassign after a recorded physical check; no automatic claim expiry.
- [ ] Notification failure/mute does not lose the order. Polling/reload recovers committed queue state; stale/offline status is visible. Lost-response retries cannot duplicate state changes or imply physical completion.
- [ ] Only supervisors/owners approve unpaid handover, post-preparation cancellation and external full refunds with actor/reason audit. Prepared unpaid losses/handovers remain unpaid exceptions, never paid revenue. Approval is not proof of payment/refund execution.
- [ ] Approved service pause behavior preserves visibility of existing work; failed delivery, wrong court and shift recovery follow approved procedures. Open timing/permission rules must be settled first.

### Payment and financial acceptance — BLOCKED pending merchant review

- [ ] Observe and document who can access official merchant records, which transaction/evidence fields actually exist, success/pending meanings and confirmation speed on employee devices. Approve the verification/matching and unavailable-record procedure. **Do not implement payment verification until this gate is resolved.**
- [ ] After that approval/implementation, authorized staff can demonstrate official-record checks, record exact amount/method/verifier/payment and verification times, and establish payment only from trusted evidence. Customer screenshot/assertion alone fails. Manual attestation is clearly distinguished from automatic bank verification.
- [ ] Matching tests use actual supported merchant evidence. Same-amount simultaneous orders, reused evidence, concurrent/repeated confirmations and lost responses cannot mark two orders paid from one transaction or duplicate funds. Do not invent merchant identifiers to make tests pass.
- [ ] Ordinary handover/completion requires recorded verified payment and actual handover. An authorized unpaid exception is separately auditable and never changes payment to paid. Payment/handover race or device failure has a recoverable authoritative outcome under the approved procedure.
- [ ] Late/extra/mismatched payments, erroneous confirmations and external refunds follow approved review/correction procedures, retaining original evidence. Unknown refund execution stays pending; no duplicate/excess refunds or false refund success.
- [ ] Independent report totals across Asia/Jakarta midnight distinguish verified collections, confirmed refunds, outstanding unpaid amounts, unique paid orders, best sellers, cancellations and unpaid prepared exceptions. Settlement is separate; demo/test/manual-import overlaps cannot inflate real collections. Exact definitions approved first.

### Safety, recovery and pilot

- [ ] Existing foundation/auth/catalog regressions, current authorization/session checks, abuse protections, input/origin handling, migration reproducibility, PostgreSQL integrity/rollback tests and relevant type/lint/build/browser checks pass.
- [ ] New migrations preserve employee/menu/location/order history. Old simulated orders/evidence stay labelled and cannot become real payments; no gateway, webhook or automated refund execution is enabled.
- [ ] Production owner provisioning/account lifecycle, HTTPS, secrets, least-privilege database roles, target devices/capacity, monitoring and staff incident/reconciliation ownership are reviewed and validated before real-customer use.
- [ ] Test merchant/system outage, numbered manual logging, online/manual overlap and supervised resumption without double counting or repeated fulfillment. No new outage orders when official verification is unavailable under retained B27.
- [ ] Restore drill demonstrates B31's one-hour digital recovery target and no permanent loss of complete paid-order details, including items, prices, destination and physical/financial history after the backup point. Define timing boundaries and other-record RPOs first; merchant references alone do not reconstruct an order.
- [ ] Staff can perform the approved merchant verification/refund/reconciliation procedure in controlled real-money validation with separate owner approval. No simulator or ordering-only test passes this gate. Court-only pilot and public launch each require approval and agreed limits/acceptance criteria.

## Phase 2 — Deferred acceptance

After Phase 1 acceptance and owner approval, define counter, pickup and dine-in payment timing, permissions and handoff before implementation; require their own failure/concurrency/financial acceptance and court regression checks. No gateway integration is required for this MVP; a proven manual merchant procedure is required for real-money court acceptance.

## Historical Milestones 1–3 — v1 acceptance scopes

The original gates below are preserved as history with their executed verification links. Their demo deadlines, automatic-payment/preparation requirements and counter/service scope do not override MVP v2. No historical passing result establishes that the revised court workflow works.

### Milestone 1 — Foundation gate (approved 2026-10-14)

- Reproducible installation, development startup, production build/local startup, TypeScript and lint checks succeed.
- Reviewed migrations apply to fresh isolated PostgreSQL and rerun without changes; constraints/rollback and wrong-target/marker rejection are tested.
- Vitest unit/integration and Chromium Playwright tests execute successfully; authentication is tested through actual hashed credentials and persisted sessions.
- Registration denial, current multiple roles, unauthorized access, origin protection, throttling, eight-hour non-refreshing expiry, thirty-minute idle expiry, logout and disabling/revocation pass.
- Passive checks do not extend inactivity; expired sessions cannot be revived. Disabling and session creation are tested concurrently.
- Database failure yields sanitized readiness failure and recovery; secrets/payment credentials are excluded and payments remain disabled.
- No ordering/payment/dashboard or deferred features; `AGENTS.md` remains preserved. Production provisioning remains a launch blocker in `OPEN_QUESTIONS.md`.

This module-specific gate does not require resolving later order/menu/payment workflows. The following MVP gates still apply before their affected modules or real-money use.

### Milestone 2 — Menu/location gate (approved 2026-10-14)

- Customers browse in Bahasa Indonesia/English without login; search/categories, inclusive IDR prices, unavailable labels and truthful loading/empty/network-error states work on mobile/desktop.
- Owners create/edit/archive menu items and manage buildings/courts/numbered tables; preparation staff can change only availability. Anonymous, delivery/supervisor, forged-field and cross-origin edits are rejected server-side.
- Prices reject fractions/negative values; names, numbered tables, parent relationships and scoped duplicate locations are validated, including database constraints.
- Concurrent stale edits return conflict; retrying creation with the same operation ID cannot duplicate records. Every committed edit has actor/before/after history; an audit failure rolls back the edit.
- Stable court-ID links preselect an active court in an active building, require explicit confirmation and allow override. Unknown/inactive/table IDs require correction; no order is created by selection.
- Additive migrations apply to isolated PostgreSQL and rerun safely; foundation regression checks pass. No real menu/location content is fabricated, no orders/payments/operational queues added.

Executed evidence belongs in `VERIFICATION-M2.md`; passing this gate does not approve Milestone 3 or production use.

### Milestone 3 — Demo ordering gate (approved 2026-10-15)

- Guest/counter checkout, all three destinations, bilingual cart/status, exact snapshot totals and explicit review after price changes work without customer registration.
- Stable checkout retries create one order, including a lost response after commit; current employee roles/sessions and private guest links enforce isolation. Court confirmation and phone are required; order numbers/pickup codes cannot grant online access.
- Only authenticated owners/supervisors can issue simulated payment/refund evidence. HMAC validation and a non-serializable server verification marker protect the shared financial engine; production refuses demo operations before database access.
- Duplicate/out-of-order/mismatched events, canceled/expired success, stock/location changes, extra payments and simultaneous cancellation/success never duplicate eligibility or erase financial history.
- Full refunds serialize per payment. Unknown outcomes stay pending; confirmed results cannot regress. Failed results alone allow a fresh authorized request.
- Injected failure during financial persistence rolls back ledger/eligibility changes while retaining the durable demo inbox; reconciliation recovers once. PostgreSQL guards enforce snapshot totals, accepted primary payment and refund amounts.
- Browser network-loss recovery, mobile layout, guest reopening, counter session expiry, migrations, source checks and foundation/catalog regressions pass. Demo tests do not validate merchant capture, real refunds or operational recovery targets.

Executed evidence belongs in `VERIFICATION-M3.md`. No Milestone 4 or production approval is implied.

## V2-2 — preparation gate (approved 2026-10-17)

- Owner/preparation can work; supervisor alone can only view; guests/delivery/counter cannot read or mutate the preparation queue. Current role removal, idle expiry, disabling and logout revoke applicable access. Staff reads expose no phone/private key/payment evidence; guest responses expose no internal review reason.
- Concurrent claims have exactly one winner/event/command. Only the assigned employee can mark ready or hold claimed work. Claim versus private guest cancellation has one valid committed outcome; cancellation fails after claim/ready. Invalid SQL transitions, assignment/timestamp rewrites and unaudited progress fail.
- Same-command concurrent/lost-response/reloaded retries commit one action; changed actor/body fails. Replaying an old claim after ready cannot reverse progress. Injected audit failure leaves no partial ownership/command/state.
- Pause persists in PostgreSQL, rejects fresh checkout and allows committed checkout recovery plus existing preparation. Version conflicts cannot silently overwrite service state; resume explicitly reopens. Checkout replay cannot bypass the existing 24-hour private-access deadline.
- Required review reasons hold work unpaid without substitution/cancellation. Ready records preparation only; ordinary delivery/payment/completion stays unavailable.
- ID/EN UI shows new/preparing/ready/review queues, actor/court/items, loading/empty/error/uncertainty states and customer progress. At 390px/1280px no page overflow; all queue tabs/actions are reachable. A blocked audio context cannot hide newly arriving work. Test-default 5-second polling recovers updates; after 15 seconds without success actions are blocked with a warning and refresh restores them.
- All eight migrations apply fresh/reapply safely; development upgrade preserves preexisting records. Relevant unit/PostgreSQL/Chromium, type/lint/build checks pass; owner device/usability/sound acceptance remains a separate human check. Production notification targets, recovery drills and merchant gate remain unresolved.

Evidence: [VERIFICATION-V2-2.md](VERIFICATION-V2-2.md). Passing local automation is not approval to start V2-3 or serve real customers.

## V2-3 — delivery, physical recovery and Team gate (approved 2026-10-17)

- Owner/delivery may claim one ready order; supervisor alone views and performs approved recovery, preparation alone cannot use delivery/Team. Assigned delivery staff alone see phone contact and progress collection/arrival. Two claims/pause races and competing physical decisions yield one consistent committed result.
- Idempotent command replay survives lost responses/reload/later progress without duplicate assignment/actions. Stale versions, forged fields and former/disabled assignees fail; audit failure rolls back the whole operation. Original destination and financial history survive correction/recovery.
- Physical reason/check is mandatory for supervisor/owner resume/reassign/cancel/correct/unpaid handover. Unavailable targets/courts fail. Absent/refused incident requires contact; collected drinks return before cancellation. Returned retry moves to awaiting collection and preserves prior claim/collection/arrival/return history. Unpaid handover is explicitly confirmed, remains unpaid and is terminal; no normal paid/completed bypass.
- Owner Team lists/counts/searches accounts, creates once with known roles/temporary password, edits with versions and revokes target sessions immediately. Nonowners/public users fail. Last enabled password-established owner cannot be removed/disabled through administration, even concurrently. No deletion/password retrieval/reset UI; active tasks remain for supervised recovery.
- Temporary-password sessions access only setup/logout/self setup metadata. New password differs, uses 12–128 characters and the existing library hash/verify; atomic audit failure leaves original credentials/flag/session unchanged. Success revokes every session and requires fresh sign-in. Secrets never enter audit/browser storage; full-reload uncertain creation is recovered by searching unique email.
- Existing ordering/preparation/catalog/auth/demo regressions, exact-IDR separation, ten fresh/reapplied migrations, schema-snapshot agreement, preserved development data, type/lint/build and relevant PostgreSQL/Chromium checks pass. ID/EN mobile/desktop screens expose clear pending/stale/empty/role states. Human café-device/procedure acceptance remains pending.

Evidence: [VERIFICATION-V2-3.md](VERIFICATION-V2-3.md). Merchant review, production bootstrap/password recovery, real-money tests and public launch are separate gates. No V2-4 implementation is authorized by passing this stage.
