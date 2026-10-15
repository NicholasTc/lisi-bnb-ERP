import { Pool } from "pg";
import { readConfig } from "../src/server/config";
import { assertDatabaseEnvironment } from "../scripts/database-safety";
export const testPool = () => {
  const config = readConfig();
  if (config.environment !== "test") throw new Error("Tests require isolated test configuration");
  return new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 2000 });
};
export async function resetTestData(pool: Pool) {
  if (readConfig().environment !== "test") throw new Error("Refusing non-test reset");
  await assertDatabaseEnvironment(pool);
  await pool.query("DELETE FROM catalog_event");
  await pool.query("DELETE FROM location");
  await pool.query("DELETE FROM building");
  await pool.query("DELETE FROM product");
  // Delete disposable test fixtures only; preserve marker/migration history.
  await pool.query('DELETE FROM "user"');
  await pool.query("DELETE FROM verification");
  await pool.query("DELETE FROM rate_limit");
}
