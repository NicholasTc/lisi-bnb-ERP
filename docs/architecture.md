# Foundation architecture

Approved 2026-10-14. Milestone 1 only; no deployment or payment processing.

- One TypeScript/Next.js application. HTTP handlers translate requests; server services enforce identity, authorization and database rules. Tailwind supplies minimal accessible styling.
- PostgreSQL is authoritative. Drizzle schemas generate reviewed SQL migrations; schema push and automatic startup migrations are not used.
- Docker Compose runs separate local development and test PostgreSQL instances. Test scripts accept only the dedicated loopback test host/port/database/user and verify a database environment marker before changing data. Production database access is excluded from local scripts.
- Local database owners can apply migrations but have no superuser/create-role/create-database/replication privileges. Production runtime-versus-migration credentials remain a launch decision.
- Better Auth provides password hashing, cookie verification and database sessions. Public registration and unneeded auth endpoints are closed. Database-backed throttling is enabled in every environment.
- Session expiry is eight hours from creation with refresh/cache disabled. Better Auth does not document an idle timeout: a server policy checks the existing session's database `last_activity_at` before access. Thirty minutes idle invalidates/deletes the session. Passive identity checks do not refresh activity; explicit same-origin activity requests do. No new token system or session store.
- Database triggers serialize session creation/activity with employee disabling. Disabling deletes sessions atomically and blocks new sessions. Authorization reads current roles on every protected request; no implicit owner permission inheritance beyond the foundation owner diagnostic.
- Public health responses expose only availability. Readiness checks connectivity, applied migrations and the environment marker. Structured error logs allow only safe codes/request IDs, never request bodies, passwords, cookies or raw database errors.
- All payments are disabled. Production configuration is documented/tested locally, not connected to production infrastructure.

See [data model](data-model.md), [foundation decision](decisions/001-foundation.md), [open questions](OPEN_QUESTIONS.md) and [run instructions](../README.md).
