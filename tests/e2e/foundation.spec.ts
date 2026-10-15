import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, expect } from "@playwright/test";
import { testPool, resetTestData } from "../database";
import { provisionEmployee, disableEmployee } from "../../src/server/provisioning";
const pool = testPool();
const password = randomBytes(20).toString("hex");
const email = "browser@example.invalid";
let id: string;
test.beforeAll(async () => {
  await resetTestData(pool);
  id = await provisionEmployee(pool, { email, name: "Browser Employee", password, roles: ["owner", "preparation"] });
  await provisionEmployee(pool, { email: "limited@example.invalid", name: "Limited Employee", password, roles: ["preparation"] });
});
test.afterAll(async () => { await resetTestData(pool); await pool.end(); });
test("application, health and protected endpoints", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "LISI BNB", exact: true })).toBeVisible();
  expect((await request.get("/api/health/live")).status()).toBe(200);
  expect((await request.get("/api/health/ready")).status()).toBe(200);
  expect((await request.get("/api/admin/health")).status()).toBe(401);
  expect((await request.post("/api/auth/sign-up/email", { data: { email, password, name: "Unapproved" } })).status()).toBe(404);
  expect((await request.post("/api/auth/sign-in/email", { headers: { origin: "https://untrusted.example.invalid" }, data: { email, password } })).status()).toBe(403);
});
test("individual sign-in, owner guard, cookies and logout", async ({ page }) => {
  await page.goto("/employee/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
  expect((await page.request.get("/api/admin/health")).status()).toBe(200);
  const cookies = await page.context().cookies();
  const session = cookies.find(cookie => cookie.name.includes("session_token"));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  const captured = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect((await page.request.get("/api/employee/me", { headers: { cookie: captured } })).status()).toBe(401);
});
test("direct requests cannot grant owner access through login input", async ({ request }) => {
  const signedIn = await request.post("/api/auth/sign-in/email", { headers: { origin: "http://127.0.0.1:3100" },
    data: { email: "limited@example.invalid", password, roles: ["owner"], enabled: true } });
  expect(signedIn.status()).toBe(200);
  expect((await request.get("/api/admin/health")).status()).toBe(403);
  const identity = await request.get("/api/employee/me");
  expect((await identity.json()).roles).toEqual(["preparation"]);
});
test("disabling and idle expiry reject existing browser access", async ({ page }) => {
  await page.goto("/employee/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
  await pool.query("UPDATE session SET last_activity_at = clock_timestamp() - interval '30 minutes' WHERE user_id = $1", [id]);
  expect((await page.request.post("/api/employee/activity", { headers: { origin: "http://127.0.0.1:3100" } })).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
  await disableEmployee(pool, id);
  expect((await page.request.get("/api/employee/me")).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});
test("readiness fails safely during an actual database interruption and recovers", async ({ request }) => {
  const execute = promisify(execFile);
  let paused = false;
  try {
    await execute("docker", ["compose", "--env-file", ".local/docker.env", "pause", "db-test"], { timeout: 10_000 });
    paused = true;
    const response = await request.get("/api/health/ready");
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_READY");
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|DATABASE_URL|stack/);
    expect((await request.get("/api/health/live")).status()).toBe(200);
  } finally {
    if (paused) await execute("docker", ["compose", "--env-file", ".local/docker.env", "unpause", "db-test"], { timeout: 10_000 });
  }
  await expect.poll(async () => (await request.get("/api/health/ready")).status(), { timeout: 15_000 }).toBe(200);
});
