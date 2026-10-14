import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", workers: 1, fullyParallel: false,
  reporter: "list", use: { baseURL: "http://127.0.0.1:3100", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node_modules/.bin/tsx scripts/run.ts e2e-server", url: "http://127.0.0.1:3100/api/health/live",
    reuseExistingServer: false, timeout: 120_000 },
});
