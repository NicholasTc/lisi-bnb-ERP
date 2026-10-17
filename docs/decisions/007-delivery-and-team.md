# 007 — V2-3 delivery, supervised recovery and Team

**2026-10-17. Implemented and verified locally; owner human acceptance pending.** The owner approved:

- Owner-created employee accounts with temporary passwords of 12–128 characters, private distribution and mandatory first-login change. No email service. Owner manages accounts/roles/disabling; individual accounts and current multiple-role vocabulary remain. No separate developer bypass. Production bootstrap/password recovery remains a launch gate.
- Ready → exclusive delivery claim → collected/on the way → arrived awaiting payment/handover. Delivery/owner work; supervisor views unless also delivery. Assigned staff may see phone contact. Ordinary payment/completion stays blocked until V2-4.
- Delivery pause blocks fresh court submissions and fresh delivery claims, preserving visible existing work and allowing already-claimed progress. Resume is explicit and durable.
- Owners/supervisors resume/reassign/cancel after a reasoned physical-progress check. Reassignment preserves physical stage and invalidates former-assignee actions. Staff hold their own work; existing preparation unclaimed review permission remains.
- Returned-delivery retry is approved: a privileged physical check returns work to awaiting collection under an eligible assignee; collection is required again. The prior attempt stays in immutable history.
- Absent/refusing customer: record contact attempt, hold work and return drinks to café before closing the issue. Active-court corrections are privileged, preserving original destination. Prepared cancellation/unpaid handover remains a separately attributed unpaid exception without invented monetary loss. Unpaid handover is an explicit exceptional action, never normal completion or payment evidence.

## Bounded implementation decisions

Keep the approved app/hosting architecture and no new dependencies. Two additive migrations separate account policy/history from delivery/recovery state. Existing accounts are not forced into a new password flow; newly created UI accounts are. Team changes use actor-bound command replay, edit versions and a serialized owner policy preventing removal/disabling of the last enabled, password-established owner. Any role/status edit revokes target sessions and retains active tasks/history for physical recovery; no account deletion or password retrieval/reset UI.

The installed Better Auth password-change endpoint does not atomically maintain our first-login flag. The small server service uses the library's existing hash/verify functions, current database session checks and one transaction for password/flag/audit/session revocation, followed by fresh sign-in. No custom token/session system. Temporary credentials grant only password setup and logout until setup succeeds. Passwords never enter browser storage, audit payloads or logs. Production administration remains closed until launch review.

Delivery keeps distinct task ownership and physical timestamps. Optimistic order versions prevent stale supervisory decisions; same-command replay returns the previous acknowledgement without reverting subsequent work. Immutable operation history records before/after physical state, reason/check and contact/return/handover evidence. Corrections store an effective destination separately from the immutable original. Cancellation/review cannot hide physical work or manufacture funds. Existing demo provenance and merchant gate remain.

Local polling/stale settings remain V2-2 test defaults. No automatic claim release, refunds, reporting/import, counter/pickup/dine-in or deployment. Executed checks and remaining gates are in [V2-3 verification](../VERIFICATION-V2-3.md).
