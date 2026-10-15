# Data model

Milestone 1 contains only employee authentication and environment isolation:

- `user`: Better Auth identity, unique email, enabled flag.
- `account`: credential hash linked to identity; unique provider/account identity.
- `session`: unique opaque token, employee foreign key, creation/absolute-expiry timestamps and server-owned last-activity timestamp. No client writes to session policy fields.
- `verification`: Better Auth schema compatibility; password recovery is not enabled.
- `rate_limit`: persistent Better Auth login-throttling records.
- `employee_role`: one row per employee/role, composite uniqueness, checked role vocabulary: preparation, delivery, supervisor, owner. Roles are never accepted from login requests.
- `environment_marker`: one environment designation created by guarded local setup and checked by migrations/test tooling/readiness.

Foreign keys prevent orphan records. Disabling an employee deletes sessions in the same database transaction; a session-insert trigger locks/checks its employee to prevent a concurrent login from restoring access.

Milestone 2 adds:
- `product`: original/optional English name, category and description; exact nonnegative integer-IDR inclusive price; availability, visibility and edit version.
- `building`: stable identity/name, active flag and edit version; case-insensitive trimmed-name uniqueness.
- `location`: stable court/numbered-table identity linked to a building, checked kind/positive table number, active flag and edit version. Names are unique within building/kind. Inactive parent buildings hide their locations.
- `catalog_event`: actor, entity identity, before/after values and timestamp, committed atomically with each catalog mutation. Restrictive employee FK preserves actor attribution; no application deletion endpoint exists.

Product/location identities are retained on archive/inactivation. Application version checks prevent stale overwrites. No order/payment records exist; later orders must freeze prices/destination details separately from this mutable catalog.
