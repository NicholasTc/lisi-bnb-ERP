import "server-only";
import type { PoolClient } from "pg";
import { getAuth } from "./auth";
import { getPool } from "./db/client";
import { HttpError } from "./http";
import { canReadOwnerDiagnostic, isRole } from "./roles";

export async function requireEmployee(headers: Headers, activity = false, allowPasswordChange = false) {
  const verified = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!verified) throw new HttpError(401, "UNAUTHENTICATED");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Shared employee lock serializes access/activity against employee disabling.
    const employee = await client.query<{ id: string; name: string; email: string; must_change_password: boolean }>(
      'SELECT id, name, email, must_change_password FROM "user" WHERE id = $1 AND enabled = true FOR SHARE', [verified.user.id]);
    const valid = employee.rowCount ? await client.query<{ id: string; expires_at: Date }>(
      `SELECT id, expires_at FROM session WHERE id = $1 AND token = $2
       AND expires_at > clock_timestamp() AND created_at > clock_timestamp() - interval '8 hours'
       AND last_activity_at > clock_timestamp() - interval '30 minutes' FOR UPDATE`,
      [verified.session.id, verified.session.token]) : null;
    if (!valid?.rowCount) {
      await client.query("DELETE FROM session WHERE id = $1 AND token = $2", [verified.session.id, verified.session.token]);
      await client.query("COMMIT");
      throw new HttpError(401, "SESSION_EXPIRED");
    }
    if (activity) await client.query("UPDATE session SET last_activity_at = clock_timestamp() WHERE id = $1", [verified.session.id]);
    const assigned = await client.query<{ role: string }>("SELECT role FROM employee_role WHERE user_id = $1", [verified.user.id]);
    await client.query("COMMIT");
    const row = employee.rows[0];
    if (row.must_change_password && !allowPasswordChange) throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED");
    return { user: { id: row.id, name: row.name, email: row.email }, passwordChangeRequired: row.must_change_password, roles: assigned.rows.map(row => row.role).filter(isRole),
      session: { id: verified.session.id, expiresAt: valid.rows[0].expires_at } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export async function requireOwner(headers: Headers) {
  const employee = await requireEmployee(headers);
  if (!canReadOwnerDiagnostic(employee.roles)) throw new HttpError(403, "FORBIDDEN");
  return employee;
}

export type EmployeeIdentity = Awaited<ReturnType<typeof requireEmployee>>;
/** Hold identity/session/role locks until the protected transaction commits. */
export async function lockEmployee(client: PoolClient, who: EmployeeIdentity, allowed: readonly string[], allowPasswordChange = false, exclusive = false) {
  const employee = (await client.query<{ must_change_password: boolean }>(
    `SELECT must_change_password FROM "user" WHERE id=$1 AND enabled FOR ${exclusive ? "UPDATE" : "SHARE"}`, [who.user.id])).rows[0];
  const session = employee && await client.query(`SELECT id FROM session WHERE id=$1 AND user_id=$2 AND expires_at>clock_timestamp()
    AND created_at>clock_timestamp()-interval '8 hours' AND last_activity_at>clock_timestamp()-interval '30 minutes' FOR SHARE`, [who.session.id, who.user.id]);
  if (!session?.rowCount) throw new HttpError(401, "SESSION_EXPIRED");
  if (employee.must_change_password && !allowPasswordChange) throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED");
  const roles=(await client.query<{role:string}>("SELECT role FROM employee_role WHERE user_id=$1 FOR SHARE",[who.user.id])).rows.map(row=>row.role);
  if (allowed.length && !roles.some(role=>allowed.includes(role))) throw new HttpError(403,"FORBIDDEN");
  return roles;
}
