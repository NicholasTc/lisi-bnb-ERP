import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) };
export default defineConfig({ test: { projects: [
  { resolve: { alias }, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
  { resolve: { alias }, test: { name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false, maxWorkers: 1, testTimeout: 20_000, hookTimeout: 20_000 } },
] } });
