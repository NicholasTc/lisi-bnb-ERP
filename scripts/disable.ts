import { Pool } from "pg";
import { readConfig } from "../src/server/config";
import { disableEmployee } from "../src/server/provisioning";
const id = process.argv[2];
if (!id) throw new Error("Supply the employee ID");
const pool = new Pool({ connectionString: readConfig().databaseUrl });
try { await disableEmployee(pool, id); console.log("Employee disabled; sessions revoked."); }
catch { console.error("Employee disable failed."); process.exitCode = 1; }
finally { await pool.end(); }
