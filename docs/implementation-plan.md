# LISI BNB ERP — MVP v2 implementation milestones

**Updated:** 2026-10-16. **Status:** V2-1 implementation approved on 2026-10-16 and implemented for local review; remaining milestones are proposed/not started. Automated evidence is in [VERIFICATION-V2-1.md](VERIFICATION-V2-1.md); owner acceptance remains pending. No production access/deployment approval.

## Direction and existing work

Build and test **customer court ordering first (Phase 1)**. Build **counter ordering, pickup and dine-in afterward (Phase 2)**. Confirmed requirements are in [decision 004](decisions/004-court-first-manual-qris.md); unresolved rules remain in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md); the full release contract is [ACCEPTANCE.md](ACCEPTANCE.md).

Keep the approved Next.js/TypeScript/PostgreSQL/Drizzle/Tailwind/Vitest/Playwright modular monolith. Reuse existing authentication, catalog, locations, exact-IDR snapshots, private recovery and retry protections. Business logic stays outside UI components and HTTP handlers. No new infrastructure or major dependency is proposed.

Historical Milestones 1–3 delivered the foundation, catalog and demo ordering. The new IDs **V2-1 through V2-8** distinguish this proposed sequence from those original milestones. Old demo success is not evidence that the new manual-payment flow works. Preserve existing accounts, catalog, locations, orders and test provenance; never relabel simulated records as real payments.

## Mandatory gates

- Implement one approved milestone at a time; verify it, report results/limitations and obtain approval before the next. This file is a proposal, not approval of its unresolved business rules.
- Before affected code, approve explicit states/transitions, permission checks and the applicable open decisions listed below. Add reviewed migrations rather than editing applied migrations, disabling constraints or silently resetting data.
- **Merchant gate:** do not implement payment verification until actual merchant access, evidence fields and confirmation timing have been confirmed and an authorized staff procedure approved. No generic mark-paid action, invented merchant reference or assumed immediate confirmation. The operational review may happen while V2-1 through V2-3 progress, without bypassing sequential code-stage approval.
- Independent court ordering/preparation/delivery tests may use clearly labelled non-production fixtures. Until V2-4 is accepted, ordinary paid handover must remain unavailable; those earlier stages cannot establish complete payment/handover acceptance. Unpaid exceptions are supervised operational records, not a workaround for payment testing or permission to launch.
- No real-customer use before production readiness and explicit pilot approval. Counter/pickup/dine-in remain outside Phase 1's ordinary UI and acceptance; preserve their existing records and code where reusable.
- No gateway, webhooks, automated refunds, advanced inventory/accounting, customer accounts/loyalty, variants/modifiers or speculative expansion in these milestones.

## Phase 1 — Court ordering first

### V2-1 — Court ordering and customer experience

**Outcome:** A guest can submit a durably persisted local test order for a confirmed court and reopen its progress screen, with clear “pay at delivery” messaging.

**Deliver:**

- Revise the court order model/eligibility and demo deadline coupling through reviewed migrations; retain immutable item prices, totals, original destination and separate payment status.
- Bright, professional, mobile-first, DoorDash-inspired simplicity with original branding: bilingual menu, cart, court confirmation, name/contact, concise checkout, order reference and private status/recovery. Show the next action; do not expose technical state names or simulator controls.
- Court-only navigation and submission paths for the revised experience; defer counter/pickup/dine-in without deleting history. Retain current origin/input/security protections and durable retry identities.
- Enforce pre-claim customer cancellation in the order service, with the actual claim/cancel race exercised when claims arrive in V2-2.

**Resolved for V2-1:** owner approved immediate unpaid preparation eligibility, no automatic order cancellation and escalation of suspicious orders. The minimal implemented state/cancellation and retained local bounds are in [decision 005](decisions/005-court-ordering.md). Actual claims and detailed operational review controls remain V2-2/V2-3; do not treat existing technical bounds as production capacity acceptance.

**Acceptance:**

- Valid submission commits one order and shows a unique reference only after server confirmation. Concurrent double-submit and lost-response retry produce one order; unavailable products/invalid courts/changed prices are handled explicitly.
- Browser closure/reopening preserves private access; another guest cannot read/cancel the order using only its reference. Server enforces the retained 24-hour access policy.
- Migration tests preserve historical demo/employee/catalog records and financial snapshots. Ordering no longer depends on successful demo payment for court preparation eligibility, while production/demo isolation remains intact.
- Owner reviews the mobile/desktop ordering flow; proposed browser checks at 390px and 1280px show no horizontal overflow, labelled inputs, usable focus/targets and clear empty/loading/error states. No payment-verification UI or endpoint is added.

**Likely affected areas:** `src/components/customer-menu.tsx`, `checkout.tsx`, `order-status.tsx`, `src/ordering/`, order APIs/services/configuration, `src/server/db/schema.ts`, new `drizzle/` migrations, customer styles and ordering tests. Exact files are confirmed during the implementation review.

### V2-2 — Preparation workflow

**Outcome:** Preparation employees see submitted court orders, claim one, prepare it and mark it ready without requiring advance payment.

**Deliver:** Focused task list/detail screens with one clear next action; durable preparation ownership and history; approved preparation availability/pause behavior; polling/refresh, visual alerts, audible cues where browser permissions allow and stale/offline feedback. Visual/polling recovery remains available when sound is blocked or muted.

**Dependencies/decisions:** V2-1 accepted. Approve preparation permissions, pause effects, notification freshness targets and item-unavailable handling before implementing them. Do not silently substitute drinks or partially fulfill orders.

**Acceptance:** Two simultaneous claims have one winner; customer cancel versus claim has one valid outcome; only the current authorized assignee can progress work. Repeated ready actions/lost responses produce one transition. Missed sound, reload or reconnection does not lose the order. Paid status is unchanged by preparation; existing work stays visible during pauses. Test current-session/role denial and database rollback as well as successful preparation.

**Likely affected areas:** preparation pages/components, a cohesive server operations module, protected operations APIs, task/audit schema/migrations and concurrency/browser tests.

### V2-3 — Delivery, supervised exceptions and employee controls

**Outcome:** Delivery staff can claim ready court orders, collect drinks and track delivery progress; supervisors can recover interrupted work without duplicate fulfillment.

**Deliver:**

- Mobile delivery task screens showing court/customer/reference and approved contact details; exclusive delivery claims and collection/progress actions.
- Supervisor/owner reassignment after a physical-progress check, cancellation and unpaid-handover exception recording with reasons. Keep ordinary completion blocked until approved payment verification exists.
- Absent/refusing customer, wrong-court and returned-drink exception paths; approved delivery/service pauses. Preserve original destination history when authorized corrections are recorded.
- Essential owner-controlled employee creation/role assignment/disabling, using the established authentication/session policy. Do not turn development-only provisioning into an unreviewed production tool.

**Dependencies/decisions:** V2-2 accepted. Approve delivery/collection transitions, correction limits, contact attempts/return disposition, post-preparation cancellation grounds, pause rules and remaining role/account-provisioning permissions. Account bootstrap/recovery decisions must be reviewed before their affected production behavior.

**Acceptance:** One delivery claimant wins; old assignee actions fail after reassignment; repeated/offline updates cannot imply successful delivery. Unpaid handover requires supervisor/owner approval and remains an unpaid exception. Only approved roles can change employees, pause services or resolve exceptions; disabling immediately revokes access. Payment-verification workflow remains unimplemented while its merchant gate is open. Use non-production fixtures to test independent operations, not a paid-status shortcut.

**Likely affected areas:** delivery/supervisor/account pages, operations/employee services and protected routes, audit/task schema/migrations and role/concurrency/browser tests.

### V2-4 — Official merchant review and manual QRIS verification

**Outcome:** After operational proof, authorized staff can verify an actual official merchant payment, record it once and complete the correct handover.

**Status:** BLOCKED for payment-verification implementation until merchant review is complete. V2-3 acceptance does not resolve this block.

**Review before coding:** Identify who can check official records and on which devices; observe actual transaction identifiers, amount/time availability, success/pending states and confirmation speed. Approve same-amount matching, duplicate/reused evidence prevention, verifier permissions, delayed/missing-record response, error correction and external full-refund evidence. If trustworthy order/payment matching cannot be established, stop and revise the procedure rather than weaken it.

**Deliver after approval:** Protected manual verification using the confirmed evidence; amount/method/verifier/timestamps and supported merchant linkage; separate paid/handover records; idempotent confirmation; supervised mismatches, extra/late funds, correction and external full-refund recording. Confirmation approval is distinct from proof of money received/refunded. No gateway or automatic refund execution.

**Acceptance:**

- Customer screenshots/assertions, unauthenticated users and unauthorized employees cannot establish payment. Actual merchant access/evidence is demonstrated operationally, not assumed from synthetic tests.
- Concurrent/repeated confirmation, lost responses and reused supported evidence cannot duplicate funds or pay two orders from one transaction; ambiguous matching remains unresolved rather than guessed paid.
- Ordinary completion requires verified payment and actual handover. Approved unpaid exceptions remain unpaid; cancellations/refunds never erase original financial history. Unknown refund results remain pending until reconciled.
- Amount mismatches, extra/late payments, merchant unavailability and mistaken confirmation follow approved auditable procedures. Payment/verification timestamps use confirmed available evidence; do not fabricate a missing merchant payment time.
- Unit/PostgreSQL/browser tests establish application behavior; any controlled real-money validation uses separate owner approval. Neither fixtures nor this milestone's code acceptance authorizes public customer use.

**Likely affected areas:** manual payment services, confirmed evidence schema/migrations, protected payment routes, delivery/supervisor screens, external refund records, financial tests and the staff procedure documentation. Existing demo tooling remains isolated test history, not normal production UI.

### V2-5 — Court sales reporting and reconciliation

**Outcome:** The owner can distinguish collected funds, unpaid work, refunds and operational exceptions and reconcile them against merchant records.

**Deliver:** Simple owner summaries/history for verified collections, confirmed external refunds, outstanding amounts, unique paid orders, best sellers, cancellations and unpaid prepared-order exceptions; merchant comparison/correction and supervised manual-outage import/reconciliation as approved. Keep settlement separate and exclude simulated records from real reports. No inventory valuation, COGS or general ledger.

**Dependencies/decisions:** V2-4 accepted. Approve formulas/recognition dates, paid/refunded/canceled counts, best-seller definitions, reconciliation ownership/frequency, external evidence and outage numbering/import/overlap rules before implementation. Retain Asia/Jakarta midnight boundaries and conservative B27 outage acceptance limits unless explicitly changed.

**Acceptance:** Independently calculated expected totals match across midnight, refunds, duplicate confirmations, actual extra funds and online/manual overlaps. An unpaid prepared/handed-over exception never appears as a paid sale. Reimport/retry cannot duplicate funds or release already fulfilled work. Report discrepancies stay visible with auditable corrections; order/reference IDs alone do not expose private customer data.

**Likely affected areas:** reporting services/owner views, reconciliation/import services and protected routes, audit/history schema where necessary and independent financial integration/browser tests.

### V2-6 — Complete court testing, production readiness and controlled pilot

**Outcome:** Phase 1 is accepted as a reliable court-only operation before Phase 2 starts; public rollout remains an explicit decision.

**Deliver:** Full customer-to-handover/exception testing; manual usability checks on agreed employee/customer devices; security/permission/concurrency review; actual merchant verification procedure; production owner bootstrap, least-privilege configuration, HTTPS/secrets, backups/restores, monitoring, staff training and outage/resumption runbooks. Propose hosting/configuration separately before selecting or deploying anything. Define pilot traffic, stop conditions and acceptance thresholds with the owner.

**Dependencies/decisions:** V2-1 through V2-5 accepted. Resolve merchant evidence and all launch-critical open items, operational latency/staleness/capacity thresholds, recovery ownership/timing and other-record RPOs. A pilot uses real money and must meet the security/payment baseline; it is not a bypass.

**Acceptance:**

- Relevant automated checks and owner human tests pass for the complete court workflow and failure paths, with actual results/limitations recorded under [ACCEPTANCE.md](ACCEPTANCE.md).
- Merchant/system outage, interrupted actions, missed alerts, absent/refusing customer, financial correction, manual overlap and restore drills show no duplicated fulfillment/funds or false payment/completion.
- Restore drills demonstrate the retained one-hour digital recovery/no permanent paid-order-detail loss target with complete item/location/financial/physical history. Do not infer recovery from merchant references or a basic database restart.
- Only after separate pilot approval: run limited real court orders, reconcile every payment/refund/exception, resolve critical findings and obtain court Phase 1 acceptance. Public expansion/deployment requires explicit authorization. No court acceptance while the merchant review remains open.

**Likely affected areas:** cross-module tests/fixes, deployment/backup configuration only after approval, runbooks/training and new verification evidence. No speculative infrastructure.

## Phase 2 — Counter, pickup and dine-in afterward

### V2-7 — Approve and implement counter/pickup/dine-in flows

**Outcome:** Employees can enter approved walk-in orders, and customers/staff can use the approved pickup/table handoff paths without changing established court behavior.

**Dependencies:** V2-6 court acceptance and explicit approval to start Phase 2. First decide timing by source/service mode, including counter-entered court deliveries; who verifies payments; table/pickup-code checks; permissions; cancellation/refund and unattended-order handling. The earlier ambiguous “yes” does not approve these details.

**Deliver:** Extend the tested order/payment/operations modules and simple app-style UI for only the newly approved modes. Reuse and migrate existing counter/pickup/dine-in code/history where appropriate; do not build a parallel ledger. Preserve explicit role checks and action attribution.

**Acceptance:** Approved counter/table/pickup paths pass authorization, idempotency, payment timing and wrong-order handoff tests. References/codes remain separate from private online access. Existing court ordering, tasks, payments and reports pass regressions. No new tender, gateway, variants or accounting features are implied.

**Likely affected areas:** counter entry, service-mode navigation/checkout, operations/handoff services, confirmed schema extensions and counter/pickup/dine-in tests.

### V2-8 — Phase 2 acceptance and controlled rollout

**Outcome:** Counter/pickup/dine-in are accepted alongside court ordering, with one consistent transaction history and reconciled sales reporting.

**Deliver:** Human/automated tests for mixed court/counter traffic and shared devices; peak/concurrency/failure exercises under agreed thresholds; reporting/outage/recovery regression; updated staff procedures; separately approved controlled Phase 2 pilot before wider rollout.

**Acceptance:** No duplicated claims, orders or funds; correct payment gates and pickup/table/court handoffs; consistent merchant/reconciliation totals; no regression to Phase 1 security/recovery. Record evidence and remaining limitations, resolve critical defects and obtain owner rollout approval. Post-MVP expansion remains separate.

## Review evidence required for each milestone

Before starting, present the bounded implementation scope, affected files, applicable decisions/risks and acceptance criteria. At completion, report changes, commands/results, any unrun tests and remaining risks; review the diff and preserve unrelated user edits. Run relevant type/lint/build checks and meaningful Vitest/PostgreSQL/Playwright tests for implemented behavior; documentation-only changes need document validation, not invented runtime results. Update architecture/data-model/decision/verification documentation only where the milestone materially changes it. Do not commit, push or deploy without instruction.

## Relationship to the old roadmap

Historical Milestones 1–3 below remain implementation/approval history. The former operations/reporting work now appears in V2-2/V2-3/V2-5 for courts first. The former real-gateway milestone is replaced for this MVP by V2-4's official merchant review/manual verification. Production readiness and pilot are retained in V2-6 for courts and revisited in V2-8 for Phase 2. These are revised scopes, not claims that previous stages already satisfy v2.

## Historical Milestones 1–3 — implemented v1 scopes

The sections below preserve original approvals and verification references; v2 changes above supersede conflicting payment/phase rules. This document does not authorize executing the new stages.

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

# Milestone 3 — Ordering with demo payments

Approved 2026-10-15 under [confirmed ordering decisions](decisions/003-ordering-proposal.md).

Deliver durable guest/counter checkout, bilingual cart/private recovery/status, immutable exact-IDR snapshots, explicit counter permissions and protected simulated-payment/refund controls. Separate demo verification/inbox from shared financial transition services. Add reviewed order/ledger migrations, transactional/idempotent processing, abuse limits and failure tests. Preserve existing owner/menu/location data.

Acceptance and verification: `ACCEPTANCE.md` Milestone 3 gate and `VERIFICATION-M3.md`. No real payments, task execution, operational dashboards, account-management UI or Milestone 4 implementation.
