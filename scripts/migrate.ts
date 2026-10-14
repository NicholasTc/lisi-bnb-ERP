import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readConfig } from "../src/server/config";
import { assertDatabaseEnvironment } from "./database-safety";

const config = readConfig();
if (config.environment === "production") throw new Error("Production migration procedure is not implemented in Milestone 1");
const pool = new Pool({ connectionString: config.databaseUrl });
try {
  await assertDatabaseEnvironment(pool, true);
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  await pool.query("INSERT INTO environment_marker (id, environment) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [config.environment]);
  await assertDatabaseEnvironment(pool);
  console.log(`Reviewed migrations applied to ${config.environment}.`);
} catch {
  console.error("Migration failed; database identity, migration state or connectivity requires inspection.");
  process.exitCode = 1;
} finally { await pool.end(); }
