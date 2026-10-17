import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, resetTestData } from "../database";
import { provisionEmployee, disableEmployee } from "../../src/server/provisioning";
import { readConfig } from "../../src/server/config";
import { authRequest } from "../../src/server/auth-http";
import { getPool } from "../../src/server/db/client";
import { publicCatalog, saveCatalog, staffCatalog } from "../../src/server/catalog";
import { POST, PATCH } from "../../src/app/api/employee/catalog/[entity]/route";

const pool = testPool();
const config = readConfig();
const password = randomBytes(20).toString("hex");
let owner: Headers, preparation: Headers, delivery: Headers, supervisor: Headers;
let ownerId: string;
async function login(role: "owner" | "preparation" | "delivery" | "supervisor") {
  const email = `${role}@example.invalid`;
  const id = await provisionEmployee(pool, { email, name: role, password, roles: [role] });
  if (role === "owner") ownerId = id;
  const response = await authRequest(new Request(`${config.origin}/api/auth/sign-in/email`, {
    method: "POST", headers: { origin: config.origin, "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  }));
  expect(response.status).toBe(200);
  return new Headers({ cookie: response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") });
}
const item = () => ({ id: randomUUID(), name: "Es kopi", nameEn: "Iced coffee", category: "Minuman", categoryEn: "Drinks",
  description: "Kopi dingin", descriptionEn: "Cold coffee", priceIdr: 25000, available: true, active: true });
const createBuilding = async (name = "Building A") => await saveCatalog(owner, "building", { id: randomUUID(), name, active: true }, true);
beforeEach(async () => {
  await resetTestData(pool);
  owner = await login("owner"); preparation = await login("preparation"); delivery = await login("delivery"); supervisor = await login("supervisor");
});
afterAll(async () => { await resetTestData(pool); await pool.end(); await getPool().end(); });
describe("PostgreSQL catalog and directory", () => {
  it("starts empty and never invents a QR location", async () => {
    expect(await publicCatalog(null)).toEqual({ orderingEnabled: true, orderingPaused: false, products: [], locations: [], qr: { status: "absent", courtId: null } });
    expect((await publicCatalog("unknown")).qr.status).toBe("invalid");
  });
  it("persists bilingual products and only public fields, preserving unavailable items", async () => {
    const input = item();
    await saveCatalog(owner, "product", input, true);
    const result = await publicCatalog(null);
    expect(result.products[0]).toMatchObject({ id: input.id, priceIdr: 25000, nameEn: "Iced coffee" });
    expect(result.products[0]).not.toHaveProperty("version");
    expect(result).not.toHaveProperty("events");
    await saveCatalog(preparation, "product", { id: input.id, version: 1, available: false }, false);
    expect((await publicCatalog(null)).products[0].available).toBe(false);
    expect((await pool.query("SELECT actor_id, before, after FROM catalog_event ORDER BY created_at DESC LIMIT 1")).rows[0])
      .toMatchObject({ actor_id: expect.any(String), before: { available: true }, after: { available: false } });
  });
  it("denies anonymous, delivery and supervisor management, and preparation price/directory edits", async () => {
    for (const headers of [new Headers(), delivery, supervisor]) {
      await expect(staffCatalog(headers)).rejects.toMatchObject({ status: headers === delivery || headers === supervisor ? 403 : 401 });
      await expect(saveCatalog(headers, "product", item(), true)).rejects.toMatchObject({ status: headers === delivery || headers === supervisor ? 403 : 401 });
    }
    const input = item(); await saveCatalog(owner, "product", input, true);
    await expect(saveCatalog(preparation, "product", { id: input.id, version: 1, available: false, priceIdr: 1 }, false)).rejects.toMatchObject({ status: 400 });
    await expect(saveCatalog(preparation, "building", { id: randomUUID(), name: "Forbidden", active: true }, true)).rejects.toMatchObject({ status: 403 });
    expect((await publicCatalog(null)).products[0].priceIdr).toBe(25000);
    expect((await staffCatalog(preparation)).buildings).toEqual([]);
  });
  it("uses current roles and rejects disabled employee sessions", async () => {
    await pool.query("DELETE FROM employee_role WHERE user_id = $1", [ownerId]);
    await expect(saveCatalog(owner, "product", item(), true)).rejects.toMatchObject({ status: 403 });
    await pool.query("INSERT INTO employee_role VALUES ($1, 'owner')", [ownerId]);
    await disableEmployee(pool, ownerId);
    await expect(saveCatalog(owner, "product", item(), true)).rejects.toMatchObject({ status: 401 });
  });
  it("rejects origin spoofing, mass assignment and fractional prices through HTTP", async () => {
    const input = item();
    const request = (body: object, origin = config.origin) => new Request(`${config.origin}/api/employee/catalog/product`, {
      method: "POST", headers: { cookie: owner.get("cookie")!, origin, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const context = { params: Promise.resolve({ entity: "product" }) };
    expect((await POST(request(input, "https://evil.example.invalid"), context)).status).toBe(403);
    expect((await POST(request({ ...input, actorId: ownerId }), context)).status).toBe(400);
    expect((await POST(request({ ...input, priceIdr: 12.5 }), context)).status).toBe(400);
    expect((await POST(request(input), context)).status).toBe(201);
    const stale = new Request(`${config.origin}/api/employee/catalog/product`, { method: "PATCH", headers: request(input).headers,
      body: JSON.stringify({ ...input, version: 2 }) });
    expect((await PATCH(stale, context)).status).toBe(409);
  });
  it("allows one concurrent edit, rejects stale overwrite and audits only committed changes", async () => {
    const input = item(); await saveCatalog(owner, "product", input, true);
    const results = await Promise.allSettled([30000, 35000].map(priceIdr => saveCatalog(owner, "product", { ...input, version: 1, priceIdr }, false)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { status: 409, code: "EDIT_CONFLICT" } });
    expect((await pool.query("SELECT count(*) FROM catalog_event WHERE entity_id = $1", [input.id])).rows[0].count).toBe("2");
    expect((await pool.query("SELECT version FROM product WHERE id = $1", [input.id])).rows[0].version).toBe(2);
  });
  it("does not duplicate a create after an uncertain response and retry", async () => {
    const input = item(); await saveCatalog(owner, "product", input, true);
    await expect(saveCatalog(owner, "product", input, true)).rejects.toMatchObject({ status: 409 });
    expect((await pool.query("SELECT count(*) FROM product")).rows[0].count).toBe("1");
    expect((await pool.query("SELECT count(*) FROM catalog_event")).rows[0].count).toBe("1");
  });
  it("rolls back the product when its audit write fails", async () => {
    const input = item();
    await pool.query(`CREATE FUNCTION test_reject_catalog_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`);
    await pool.query("CREATE TRIGGER test_catalog_audit_failure BEFORE INSERT ON catalog_event FOR EACH ROW EXECUTE FUNCTION test_reject_catalog_audit()");
    try {
      await expect(saveCatalog(owner, "product", input, true)).rejects.toBeDefined();
      expect((await pool.query("SELECT count(*) FROM product WHERE id = $1", [input.id])).rows[0].count).toBe("0");
    } finally {
      await pool.query("DROP TRIGGER test_catalog_audit_failure ON catalog_event");
      await pool.query("DROP FUNCTION test_reject_catalog_audit()");
    }
  });
  it("archives without deleting history and enforces price/name constraints in PostgreSQL", async () => {
    const input = item(); await saveCatalog(owner, "product", input, true);
    await saveCatalog(owner, "product", { ...input, version: 1, active: false }, false);
    expect((await publicCatalog(null)).products).toHaveLength(0);
    expect((await staffCatalog(owner)).products).toHaveLength(1);
    await expect(pool.query("UPDATE product SET price_idr = -1")).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE product SET name = ' '")).rejects.toMatchObject({ code: "23514" });
  });
  it("validates parent, scoped duplicate names, numbered tables and immutable location identity", async () => {
    const parent = await createBuilding(); const second = await createBuilding("Building B");
    const court = { id: randomUUID(), buildingId: parent.id, kind: "court", name: "Padel 1", tableNumber: null, active: true };
    await saveCatalog(owner, "location", court, true);
    await expect(saveCatalog(owner, "building", { id: randomUUID(), name: " building a ", active: true }, true)).rejects.toMatchObject({ status: 409 });
    await expect(saveCatalog(owner, "location", { ...court, id: randomUUID(), name: " PADEL 1 " }, true)).rejects.toMatchObject({ status: 409 });
    await expect(saveCatalog(owner, "location", { ...court, id: randomUUID(), buildingId: randomUUID() }, true)).rejects.toMatchObject({ code: "INVALID_BUILDING" });
    await expect(saveCatalog(owner, "location", { ...court, version: 1, buildingId: second.id }, false)).rejects.toMatchObject({ code: "LOCATION_IDENTITY_FIXED" });
    await expect(pool.query("INSERT INTO location (id, building_id, kind, name) VALUES ($1, $2, 'table', '1')", [randomUUID(), parent.id])).rejects.toMatchObject({ code: "23514" });
    await saveCatalog(owner, "location", { id: randomUUID(), buildingId: parent.id, kind: "table", tableNumber: 3, active: true }, true);
    expect((await publicCatalog(null)).locations.find(place => place.kind === "table")?.tableNumber).toBe(3);
  });
  it("resolves QR IDs after rename and rejects inactive courts/buildings and table IDs", async () => {
    const parent = await createBuilding();
    const court = { id: randomUUID(), buildingId: parent.id, kind: "court", name: "Tennis 1", tableNumber: null, active: true };
    const table = { id: randomUUID(), buildingId: parent.id, kind: "table", tableNumber: 1, active: true };
    await saveCatalog(owner, "location", court, true); await saveCatalog(owner, "location", table, true);
    expect((await publicCatalog(court.id)).qr).toEqual({ status: "valid", courtId: court.id });
    expect((await publicCatalog(table.id)).qr.status).toBe("invalid");
    await saveCatalog(owner, "location", { ...court, version: 1, name: "Renamed court" }, false);
    expect((await publicCatalog(court.id)).locations.find(value => value.id === court.id)?.name).toBe("Renamed court");
    await saveCatalog(owner, "location", { ...court, version: 2, active: false }, false);
    expect((await publicCatalog(court.id)).qr.status).toBe("invalid");
    await saveCatalog(owner, "location", { ...court, version: 3 }, false);
    await saveCatalog(owner, "building", { id: parent.id, name: "Building A", version: 1, active: false }, false);
    expect((await publicCatalog(court.id)).locations).toEqual([]);
  });
});
