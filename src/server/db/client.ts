import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readConfig } from "../config";
import * as schema from "./schema";

const globals = globalThis as unknown as { foundationPool?: Pool };
export function getPool() {
  if (!globals.foundationPool) {
    globals.foundationPool = new Pool({ connectionString: readConfig().databaseUrl,
      max: 10, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 2500 });
    globals.foundationPool.on("error", () => console.error(JSON.stringify({ level: "error", code: "DB_POOL_ERROR" })));
  }
  return globals.foundationPool;
}
export function getDb() { return drizzle(getPool(), { schema }); }
