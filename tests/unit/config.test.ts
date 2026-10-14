import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readConfig, assertLocalDatabase } from "../../src/server/config";
const secret = randomBytes(32).toString("hex");
const base = { APP_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3100", PAYMENTS_MODE: "disabled",
  DATABASE_URL: `postgresql://lisi_test:${secret}@127.0.0.1:55433/lisi_test`, BETTER_AUTH_SECRET: secret };
describe("environment isolation", () => {
  it("accepts the isolated local test configuration", () => expect(readConfig(base).environment).toBe("test"));
  it.each([
    ["missing environment", { APP_ENV: undefined }],
    ["unknown environment", { APP_ENV: "staging" }],
    ["real payment mode", { PAYMENTS_MODE: "live" }],
    ["demo mode in foundation", { PAYMENTS_MODE: "demo" }],
    ["payment credential", { PAYMENT_SECRET: secret }],
    ["short auth secret", { BETTER_AUTH_SECRET: "invalid" }],
    ["template secret", { BETTER_AUTH_SECRET: "<generate-at-least-32-random-characters>" }],
    ["remote local origin", { APP_ORIGIN: "https://example.invalid" }],
    ["origin URL credentials", { APP_ORIGIN: "http://user:password@127.0.0.1:3100" }],
  ])("rejects %s", (_name, change) => expect(() => readConfig({ ...base, ...change })).toThrow());
  it.each([
    `postgresql://lisi_dev:${secret}@127.0.0.1:55432/lisi_dev`,
    `postgresql://lisi_test:${secret}@remote.example.invalid:55433/lisi_test`,
    `${base.DATABASE_URL}?host=remote.example.invalid`,
    `${base.DATABASE_URL}?options=-csearch_path=public`,
    `${base.DATABASE_URL}#anything`,
    base.DATABASE_URL.replace("://lisi_test:", "://other:"),
  ])("rejects unsafe test target", url => expect(() => assertLocalDatabase(url, "test")).toThrow());
  it("requires production HTTPS and encrypted separate database", () => {
    const production = { ...base, APP_ENV: "production", APP_ORIGIN: "https://erp.example.invalid",
      DATABASE_URL: `postgresql://runtime:${secret}@db.example.invalid/lisi_production?sslmode=verify-full` };
    expect(readConfig(production).environment).toBe("production");
    expect(() => readConfig({ ...production, APP_ORIGIN: "http://erp.example.invalid" })).toThrow();
    expect(() => readConfig({ ...production, DATABASE_URL: production.DATABASE_URL.split("?")[0] })).toThrow();
    expect(() => readConfig({ ...production, DATABASE_URL: production.DATABASE_URL.replace("lisi_production", "lisi_test") })).toThrow();
  });
});
