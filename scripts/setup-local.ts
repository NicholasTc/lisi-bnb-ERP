import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod, appendFile } from "node:fs/promises";
import { parse } from "dotenv";

await mkdir(".local", { recursive: true, mode: 0o700 });
await chmod(".local", 0o700);
async function writeOnce(path: string, contents: string) {
  try { await writeFile(path, contents, { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
}
await writeOnce(".local/docker.env", `DEV_DB_PASSWORD=${randomBytes(32).toString("hex")}\nTEST_DB_PASSWORD=${randomBytes(32).toString("hex")}\n`);
const secrets = parse(await readFile(".local/docker.env"));
for (const key of ["DEV_BOOTSTRAP_PASSWORD", "TEST_BOOTSTRAP_PASSWORD"]) {
  if (!secrets[key]) {
    secrets[key] = randomBytes(32).toString("hex");
    await appendFile(".local/docker.env", `${key}=${secrets[key]}\n`, { mode: 0o600 });
  }
  if (!/^[a-f0-9]{64}$/.test(secrets[key])) throw new Error("Invalid local bootstrap configuration");
}
for (const environment of ["development", "test"] as const) {
  const test = environment === "test";
  const suffix = test ? "test" : "dev";
  const password = secrets[test ? "TEST_DB_PASSWORD" : "DEV_DB_PASSWORD"];
  if (!/^[a-f0-9]{64}$/.test(password ?? "")) throw new Error("Invalid local database secrets file");
  await writeOnce(`.local/${environment}.env`, `APP_ENV=${environment}\nAPP_ORIGIN=http://127.0.0.1:${test ? "3100" : "3000"}\nDATABASE_URL=postgresql://lisi_${suffix}:${password}@127.0.0.1:${test ? "55433" : "55432"}/lisi_${suffix}\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nPAYMENTS_MODE=disabled\n`);
}
console.log("Local configuration prepared. Existing files and secrets were not overwritten.");
