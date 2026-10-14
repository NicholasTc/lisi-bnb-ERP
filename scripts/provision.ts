import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { Pool } from "pg";
import { readConfig } from "../src/server/config";
import { provisionEmployee } from "../src/server/provisioning";
import { isRole } from "../src/server/roles";

const [email, name, roleList] = process.argv.slice(2);
if (!email || !name || !roleList) throw new Error('Usage: npm run employee:provision -- <email> "<name>" preparation,delivery');
const assigned = roleList.split(",");
if (!assigned.every(isRole)) throw new Error("Unknown role");
let password = process.env.EMPLOYEE_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) throw new Error("Use an interactive terminal or supply EMPLOYEE_PASSWORD securely");
  process.stdout.write("Employee password (input hidden): ");
  const hiddenOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const prompt = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  password = await prompt.question("");
  prompt.close();
  process.stdout.write("\n");
}
const pool = new Pool({ connectionString: readConfig().databaseUrl });
try {
  const id = await provisionEmployee(pool, { email, name, password, roles: assigned });
  console.log(`Employee created. ID: ${id}`);
} catch { console.error("Employee provisioning failed; check input and database readiness. Existing accounts are never overwritten."); process.exitCode = 1; }
finally { await pool.end(); }
