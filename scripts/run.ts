import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import { readConfig } from "../src/server/config";

const action = process.argv[2];
const commands: Record<string, { test?: boolean; command: string[] }> = {
  // Avoid the reproduced Turbopack restart/hash-mismatch loop on the local dev server.
  dev: { command: ["next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"] },
  start: { command: ["next", "start", "--hostname", "127.0.0.1", "--port", "3000"] },
  integration: { test: true, command: ["vitest", "run", "--project", "integration"] },
  e2e: { test: true, command: ["playwright", "test"] },
  "e2e-server": { test: true, command: ["tsx", "scripts/e2e-server.ts"] },
  generate: { command: ["drizzle-kit", "generate"] },
  migrate: { command: ["tsx", "scripts/migrate.ts"] },
  "migrate-test": { test: true, command: ["tsx", "scripts/migrate.ts"] },
  provision: { command: ["tsx", "scripts/provision.ts"] },
  disable: { command: ["tsx", "scripts/disable.ts"] },
};
const selected = commands[action];
if (!selected) throw new Error("Unknown local command");
const environment = selected.test ? "test" : "development";
let file: string;
try { file = await readFile(`.local/${environment}.env`, "utf8"); }
catch { throw new Error("Run npm run local:setup first"); }
const env = { ...process.env, ...parse(file) };
if (readConfig(env).environment !== environment) throw new Error("Local command environment mismatch");
const child = spawn(`node_modules/.bin/${selected.command[0]}`, [...selected.command.slice(1), ...process.argv.slice(3)],
  { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Local command could not start"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
