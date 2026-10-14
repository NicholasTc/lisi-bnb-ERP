# Foundation data model

Milestone 1 contains only employee authentication and environment isolation:

- `user`: Better Auth identity, unique email, enabled flag.
- `account`: credential hash linked to identity; unique provider/account identity.
- `session`: unique opaque token, employee foreign key, creation/absolute-expiry timestamps and server-owned last-activity timestamp. No client writes to session policy fields.
- `verification`: Better Auth schema compatibility; password recovery is not enabled.
- `rate_limit`: persistent Better Auth login-throttling records.
- `employee_role`: one row per employee/role, composite uniqueness, checked role vocabulary: preparation, delivery, supervisor, owner. Roles are never accepted from login requests.
- `environment_marker`: one environment designation created by guarded local setup and checked by migrations/test tooling/readiness.

Foreign keys prevent orphan records. Disabling an employee deletes sessions in the same database transaction; a session-insert trigger locks/checks its employee to prevent a concurrent login from restoring access.

No order/payment or money fields exist. Future money fields must use integer IDR and approved constraints; their schema is deliberately deferred.
