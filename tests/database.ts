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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Deferred integrity checks see the complete isolated-test cleanup at commit.
    for (const table of ["financial_event", "demo_inbox", "order_event", "refund", "payment_transaction", "order_item", "customer_order", "catalog_event", "location", "building", "product", '"user"', "verification", "rate_limit"]) {
      await client.query(`DELETE FROM ${table}`);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
