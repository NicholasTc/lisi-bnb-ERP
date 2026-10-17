import { randomBytes } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { parse } from "dotenv";
import { readConfig } from "../src/server/config";
for (const environment of ["development", "test"] as const) {
  const path = `.local/${environment}.env`;
  let contents = await readFile(path, "utf8");
  const existing = parse(contents);
  if (readConfig(existing).environment !== environment) throw new Error("Local demo environment mismatch");
  contents = contents.replace(/^PAYMENTS_MODE=.*$/m, "PAYMENTS_MODE=demo");
  if (!existing.DEMO_PAYMENT_SECRET) contents += `\nDEMO_PAYMENT_SECRET=${randomBytes(32).toString("hex")}\n`;
  const next = parse(contents);
  if (readConfig(next).environment !== environment || next.PAYMENTS_MODE !== "demo") throw new Error("Invalid local demo configuration");
  await writeFile(`${path}.tmp`, contents, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
console.log("Isolated demo payments enabled. Restart the development app. No real payment integration is configured.");
