import { spawn } from "node:child_process";
import { readConfig } from "../src/server/config";

// Exercise the packaged application without competing development-file watchers.
// APP_ENV remains test; NODE_ENV only selects Next.js' build/runtime mode.
if (readConfig().environment !== "test") throw new Error("Browser server requires isolated test configuration");
async function run(args: string[]) {
  const child = spawn("node_modules/.bin/next", args, {
    stdio: "inherit", env: { ...process.env, NODE_ENV: "production" },
  });
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGTERM", terminate); process.on("SIGINT", terminate);
  try {
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolve() : reject(new Error("Browser application process failed")));
    });
  } finally { process.off("SIGTERM", terminate); process.off("SIGINT", terminate); }
}
await run(["build"]);
await run(["start", "--hostname", "127.0.0.1", "--port", "3100"]);
