import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, resetTestData } from "../database";
import { provisionEmployee, disableEmployee } from "../../src/server/provisioning";
import { readConfig } from "../../src/server/config";
import { assertDatabaseEnvironment } from "../../scripts/database-safety";
import { authRequest } from "../../src/server/auth-http";
import { handleRequest } from "../../src/server/http";
import { requireEmployee, requireOwner } from "../../src/server/employee";
import { checkReadiness } from "../../src/server/health";
import { getPool } from "../../src/server/db/client";

const pool = testPool();
const config = readConfig();
const password = randomBytes(20).toString("hex");
const email = "employee@example.invalid";
let employeeId: string;
async function request(path: string, body?: object, cookie?: string, origin = config.origin) {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  if (body || path === "sign-out") headers.set("content-type", "application/json");
  return handleRequest(() => authRequest(new Request(`${config.origin}/api/auth/${path}`, {
    method: body || path === "sign-out" ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : path === "sign-out" ? "{}" : undefined,
  })));
}
async function login() {
  const response = await request("sign-in/email", { email, password });
  expect(response.status).toBe(200);
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  expect(cookie).toContain("session_token");
  expect(await response.text()).not.toContain('"token"');
  return cookie;
}
const headersFor = (cookie: string) => new Headers({ cookie });

beforeAll(async () => { await assertDatabaseEnvironment(pool); });
beforeEach(async () => {
  await resetTestData(pool);
  employeeId = await provisionEmployee(pool, { email, name: "Test Employee", password, roles: ["preparation", "delivery"] });
});
afterAll(async () => { await resetTestData(pool); await pool.end(); await getPool().end(); });

describe("real PostgreSQL foundation", () => {
  it("has applied both migrations and is ready", async () => {
    expect(Number((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count)).toBe(2);
    await expect(checkReadiness()).resolves.toBeUndefined();
  });
  it("uses a local database owner without cluster administration privileges", async () => {
    const role = (await pool.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = current_user")).rows[0];
    expect(role).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false });
  });
  it("refuses reset if the environment marker disagrees", async () => {
    await pool.query("UPDATE environment_marker SET environment = 'development'");
    try { await expect(resetTestData(pool)).rejects.toThrow("marker mismatch"); }
    finally { await pool.query("UPDATE environment_marker SET environment = 'test'"); }
    expect((await pool.query('SELECT count(*) FROM "user"')).rows[0].count).toBe("1");
  });
  it("enforces foreign keys, unique employee roles, known roles and unique email", async () => {
    await expect(pool.query("INSERT INTO employee_role VALUES ($1, 'owner')", [randomUUID()])).rejects.toMatchObject({ code: "23503" });
    await expect(pool.query("INSERT INTO employee_role VALUES ($1, 'delivery')", [employeeId])).rejects.toMatchObject({ code: "23505" });
    await expect(pool.query("INSERT INTO employee_role VALUES ($1, 'unknown')", [employeeId])).rejects.toMatchObject({ code: "23514" });
    await expect(provisionEmployee(pool, { email, name: "Duplicate", password, roles: ["owner"] })).rejects.toBeDefined();
    expect((await pool.query('SELECT count(*) FROM "user"')).rows[0].count).toBe("1");
  });
  it("rolls back multi-step database writes on failure", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query('UPDATE "user" SET name = $1 WHERE id = $2', ["Uncommitted", employeeId]);
      await expect(client.query("INSERT INTO employee_role VALUES ($1, 'unknown')", [employeeId])).rejects.toBeDefined();
      await client.query("ROLLBACK");
    } finally { client.release(); }
    expect((await pool.query('SELECT name FROM "user" WHERE id = $1', [employeeId])).rows[0].name).toBe("Test Employee");
  });
  it("refuses production provisioning/disabling before database access", async () => {
    const saved = { APP_ENV: process.env.APP_ENV, APP_ORIGIN: process.env.APP_ORIGIN, DATABASE_URL: process.env.DATABASE_URL };
    try {
      process.env.APP_ENV = "production";
      process.env.APP_ORIGIN = "https://erp.example.invalid";
      process.env.DATABASE_URL = `postgresql://runtime:${password}@db.example.invalid/lisi_production?sslmode=verify-full`;
      await expect(provisionEmployee(pool, { email, name: "Blocked", password, roles: ["owner"] })).rejects.toThrow("Production provisioning");
      await expect(disableEmployee(pool, employeeId)).rejects.toThrow("Production employee administration");
    } finally { Object.assign(process.env, saved); }
    expect((await pool.query('SELECT enabled FROM "user" WHERE id = $1', [employeeId])).rows[0].enabled).toBe(true);
  });
  it("authenticates with real hashed credentials and current multiple roles", async () => {
    const cookie = await login();
    const employee = await requireEmployee(headersFor(cookie));
    expect(employee.roles.sort()).toEqual(["delivery", "preparation"]);
    expect((await pool.query("SELECT password FROM account")).rows[0].password).not.toBe(password);
    await expect(requireOwner(headersFor(cookie))).rejects.toMatchObject({ status: 403 });
    await pool.query("INSERT INTO employee_role VALUES ($1, 'owner')", [employeeId]);
    await expect(requireOwner(headersFor(cookie))).resolves.toBeDefined();
    await pool.query("DELETE FROM employee_role WHERE role = 'owner'");
    await expect(requireOwner(headersFor(cookie))).rejects.toMatchObject({ status: 403 });
  });
  it("denies unauthenticated and forged-cookie access", async () => {
    await expect(requireOwner(new Headers())).rejects.toMatchObject({ status: 401 });
    await expect(requireEmployee(headersFor(`better-auth.session_token=${randomUUID()}`))).rejects.toMatchObject({ status: 401 });
  });
  it("rejects invalid credentials and public registration", async () => {
    expect((await request("sign-in/email", { email, password: randomBytes(20).toString("hex") })).status).toBe(401);
    expect((await request("sign-up/email", { email: "other@example.invalid", password, name: "Other" })).status).toBe(404);
    expect((await pool.query('SELECT count(*) FROM "user"')).rows[0].count).toBe("1");
  });
  it("rejects untrusted origin even without a session", async () => {
    expect((await request("sign-in/email", { email, password }, undefined, "https://other.example.invalid")).status).toBe(403);
  });
  it("persists throttling and caps simultaneous login attempts", async () => {
    const responses = await Promise.all(Array.from({ length: 16 }, () => request("sign-in/email", { email, password: "invalid-password" })));
    expect(responses.filter(response => response.status === 401)).toHaveLength(10);
    expect(responses.filter(response => response.status === 429)).toHaveLength(6);
    expect((await pool.query('SELECT max(count) FROM rate_limit WHERE key LIKE $1', ["%sign-in/email%"])).rows[0].max).toBe(10);
  });
  it("logout immediately invalidates the previously issued cookie", async () => {
    const cookie = await login();
    expect((await request("sign-out", undefined, cookie)).status).toBe(200);
    expect((await pool.query("SELECT count(*) FROM session")).rows[0].count).toBe("0");
    await expect(requireEmployee(headersFor(cookie))).rejects.toMatchObject({ status: 401 });
  });
  it("sets eight-hour absolute expiry and does not refresh it", async () => {
    const cookie = await login();
    const before = (await pool.query("SELECT created_at, expires_at FROM session")).rows[0];
    expect(before.expires_at.getTime() - before.created_at.getTime()).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
    expect(before.expires_at.getTime() - before.created_at.getTime()).toBeGreaterThan(8 * 60 * 60 * 1000 - 5000);
    await requireEmployee(headersFor(cookie), true);
    expect((await pool.query("SELECT expires_at FROM session")).rows[0].expires_at).toEqual(before.expires_at);
    await expect(pool.query("UPDATE session SET expires_at = expires_at + interval '1 second'")).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects absolute expiry, including replayed cookies", async () => {
    const cookie = await login();
    await pool.query("UPDATE session SET expires_at = created_at + interval '1 millisecond'");
    await new Promise(resolve => setTimeout(resolve, 5));
    await expect(requireEmployee(headersFor(cookie))).rejects.toMatchObject({ status: 401 });
  });
  it("passive checks do not extend inactivity; active requests do", async () => {
    const cookie = await login();
    await pool.query("UPDATE session SET last_activity_at = clock_timestamp() - interval '29 minutes'");
    const previous = (await pool.query("SELECT last_activity_at FROM session")).rows[0].last_activity_at;
    await requireEmployee(headersFor(cookie));
    expect((await pool.query("SELECT last_activity_at FROM session")).rows[0].last_activity_at).toEqual(previous);
    await requireEmployee(headersFor(cookie), true);
    expect((await pool.query("SELECT last_activity_at FROM session")).rows[0].last_activity_at.getTime()).toBeGreaterThan(previous.getTime());
  });
  it("expired idle sessions cannot be revived by activity or native get-session", async () => {
    const cookie = await login();
    await pool.query("UPDATE session SET last_activity_at = clock_timestamp() - interval '30 minutes'");
    expect((await request("get-session", undefined, cookie)).status).toBe(401);
    await expect(requireEmployee(headersFor(cookie), true)).rejects.toMatchObject({ status: 401 });
    expect((await pool.query("SELECT count(*) FROM session")).rows[0].count).toBe("0");
  });
  it("disabling revokes all sessions and prevents another login", async () => {
    const cookie = await login();
    await login();
    await disableEmployee(pool, employeeId);
    expect((await pool.query("SELECT count(*) FROM session")).rows[0].count).toBe("0");
    await expect(requireEmployee(headersFor(cookie))).rejects.toMatchObject({ status: 401 });
    expect((await request("sign-in/email", { email, password })).status).toBe(401);
    await expect(pool.query("INSERT INTO session (id, token, user_id, expires_at) VALUES ($1, $2, $3, clock_timestamp() + interval '8 hours')",
      [randomUUID(), randomUUID(), employeeId])).rejects.toMatchObject({ code: "23514" });
  });
  it("serializes concurrent disabling and new-session creation", async () => {
    const transaction = await pool.connect();
    try {
      await transaction.query("BEGIN");
      await transaction.query('UPDATE "user" SET enabled = false WHERE id = $1', [employeeId]);
      const creation = pool.query("INSERT INTO session (id, token, user_id, expires_at) VALUES ($1, $2, $3, clock_timestamp() + interval '8 hours')",
        [randomUUID(), randomUUID(), employeeId]);
      // Attach rejection handling before releasing the competing transaction.
      const result = creation.then(() => "created", error => (error as { code: string }).code);
      await transaction.query("COMMIT");
      expect(await result).toBe("23514");
      expect((await pool.query("SELECT count(*) FROM session")).rows[0].count).toBe("0");
    } finally { await transaction.query("ROLLBACK"); transaction.release(); }
  });
});
