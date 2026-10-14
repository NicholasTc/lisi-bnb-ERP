import { Pool } from "pg";
import { assertLocalDatabase, readConfig } from "../src/server/config";

export async function assertDatabaseEnvironment(pool: Pool, allowUninitialized = false) {
  const config = readConfig();
  if (config.environment === "production") throw new Error("Local database tools cannot run in production");
  assertLocalDatabase(config.databaseUrl, config.environment);
  const suffix = config.environment === "test" ? "test" : "dev";
  const identity = await pool.query<{ db: string; username: string }>("SELECT current_database() AS db, current_user AS username");
  if (identity.rows[0].db !== `lisi_${suffix}` || identity.rows[0].username !== `lisi_${suffix}`) {
    throw new Error("Database identity mismatch");
  }
  const exists = await pool.query<{ relation: string | null }>("SELECT to_regclass('public.environment_marker') AS relation");
  if (!exists.rows[0].relation) {
    if (allowUninitialized) return;
    throw new Error("Database environment marker missing; run migrations first");
  }
  const marker = await pool.query<{ environment: string }>("SELECT environment FROM environment_marker WHERE id = 1");
  if (!marker.rowCount && allowUninitialized) return;
  if (marker.rows[0]?.environment !== config.environment) throw new Error("Database environment marker mismatch");
}
