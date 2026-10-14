import { defineConfig } from "drizzle-kit";
import { readConfig } from "./src/server/config";
export default defineConfig({ dialect: "postgresql", schema: "./src/server/db/schema.ts", out: "./drizzle",
  dbCredentials: { url: readConfig().databaseUrl }, strict: true, verbose: false });
