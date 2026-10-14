import "server-only";
import { getAuth } from "./auth";
import { getPool } from "./db/client";
import { HttpError } from "./http";
import { canReadOwnerDiagnostic, isRole } from "./roles";

export async function requireEmployee(headers: Headers, activity = false) {
  const verified = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!verified) throw new HttpError(401, "UNAUTHENTICATED");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Shared employee lock serializes access/activity against employee disabling.
    const employee = await client.query<{ id: string; name: string; email: string }>(
      'SELECT id, name, email FROM "user" WHERE id = $1 AND enabled = true FOR SHARE', [verified.user.id]);
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
    return { user: employee.rows[0], roles: assigned.rows.map(row => row.role).filter(isRole),
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
