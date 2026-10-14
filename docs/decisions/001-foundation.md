# 001 — Application foundation

**Approved:** product owner, 2026-10-14. **Scope:** Milestone 1 only.

TypeScript + Next.js App Router, PostgreSQL, Drizzle ORM, Tailwind, Vitest and Playwright. npm lockfile and a supported Node 22 runtime keep local setup reproducible. Better Auth is accepted subject to configuration/source review and executed integration tests.

Use existing PostgreSQL for durable sessions, roles and throttling; no Redis, external identity service, queue service or production hosting introduced. Local Docker containers provide isolated development/test PostgreSQL.

Native Better Auth settings implement eight-hour expiry, no refresh and no cookie session cache. A small database session policy implements the approved thirty-minute inactivity timeout because no native idle-expiry option is documented. Login/session tokens remain managed by Better Auth. Database locking/triggers enforce revocation on disabling, including login races. Idle time represents explicit authenticated activity, not background polling.

Tradeoff: current identity/role/idle checks require database access; failure denies access. Database throttling adds writes but works across restarts/processes. Its concurrency behavior must be inspected and tested rather than assumed.

Development/test provisioning is local-only and takes secrets at runtime. Production owner provisioning, recovery, password-reset delivery, MFA and trusted proxy/IP configuration are launch decisions, not implemented here.
