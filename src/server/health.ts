import "server-only";
import { getPool } from "./db/client";
import { readConfig } from "./config";
import { HttpError } from "./http";

export async function checkReadiness() {
  try {
    const result = await getPool().query<{ environment: string; count: string }>(
      `SELECT environment, (SELECT count(*) FROM drizzle.__drizzle_migrations) AS count
       FROM environment_marker WHERE id = 1`);
    if (result.rows[0]?.environment !== readConfig().environment || Number(result.rows[0]?.count) < 10) throw new Error("Not ready");
  } catch { throw new HttpError(503, "NOT_READY"); }
}
