import { randomBytes, randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { testPool, resetTestData } from "../database";
import { provisionEmployee } from "../../src/server/provisioning";
const pool = testPool();
const password = randomBytes(20).toString("hex");
test.beforeEach(async () => {
  await resetTestData(pool);
  await provisionEmployee(pool, { email: "catalog-owner@example.invalid", name: "Catalog Owner", password, roles: ["owner"] });
  await provisionEmployee(pool, { email: "catalog-prep@example.invalid", name: "Catalog Preparation", password, roles: ["preparation"] });
});
test.afterAll(async () => { await resetTestData(pool); await pool.end(); });
async function signIn(page: Page, role = "owner") {
  await page.goto("/employee/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(`catalog-${role}@example.invalid`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}
async function seedMenu() {
  const id = randomUUID();
  await pool.query(`INSERT INTO product (id, name, name_en, description, description_en, category, category_en, price_idr)
    VALUES ($1, 'Es kopi susu', 'Iced milk coffee', 'Kopi dan susu dingin', 'Cold coffee with milk', 'Minuman', 'Drinks', 28000)`, [id]);
  return id;
}
async function seedCourts() {
  const building = randomUUID(), court = randomUUID(), second = randomUUID();
  await pool.query("INSERT INTO building (id, name) VALUES ($1, 'Demo Sports Hall')", [building]);
  await pool.query("INSERT INTO location (id, building_id, kind, name) VALUES ($1, $2, 'court', 'Padel 1'), ($3, $2, 'court', 'Tennis 2')", [court, building, second]);
  return { building, court, second };
}
test("empty bilingual customer menu without invented products or checkout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Menu belum tersedia.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Good drinks. Better breaks." })).toBeVisible();
  await expect(page.getByText("The menu is not available yet.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today's menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /checkout|pay|order now/i })).toHaveCount(0);
});
test("owner creates and edits bilingual products, customer searches and mobile layout stays usable", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Manage menu & locations" }).click();
  await page.getByRole("button", { name: "Add menu item" }).click();
  const form = page.getByRole("form", { name: "Add product" });
  await form.getByLabel("Item name", { exact: true }).fill("Es kopi susu");
  await form.getByLabel("English item name (optional)").fill("Iced milk coffee");
  await form.getByLabel("Category", { exact: true }).fill("Minuman");
  await form.getByLabel("English category (optional)").fill("Drinks");
  await form.getByLabel("Description (optional)", { exact: true }).fill("Kopi dan susu dingin");
  await form.getByLabel("English description (optional)").fill("Cold coffee with milk");
  await form.getByLabel("Final price (IDR)").fill("28000");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Es kopi susu" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Es kopi susu", exact: true }).click();
  await page.getByLabel("Final price (IDR)").fill("30000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Minuman · Rp 30.000")).toBeVisible();
  await seedCourts();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Es kopi susu" })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Iced milk coffee" })).toBeVisible();
  await page.getByRole("button", { name: "Drinks", exact: true }).click();
  await expect(page.getByText("Rp 30.000", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search menu" }).fill("not-in-menu");
  await expect(page.getByText("No matching items.", { exact: false })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search menu" }).clear();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Iced milk coffee" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".local/menu-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: ".local/menu-desktop.png", fullPage: true });
});
test("owner manages an initially empty building/court/table directory", async ({ page }) => {
  await signIn(page); await page.goto("/employee/menu");
  await page.getByRole("button", { name: "Locations", exact: true }).click();
  await expect(page.getByText("Start by adding a building", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add building" }).click();
  await page.getByLabel("Building name").fill("Sports Hall");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Sports Hall" })).toBeVisible();
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByRole("form", { name: "Add location" })).toBeVisible();
  await page.getByLabel("Building", { exact: true }).selectOption({ label: "Sports Hall" });
  await page.getByLabel("Court name").fill("Padel 1");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("link", { name: "Open court QR destination" })).toBeVisible();
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByLabel("Building", { exact: true }).selectOption({ label: "Sports Hall" });
  await page.getByLabel("Location type").selectOption("table");
  await page.getByLabel("Table number").fill("7");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Table 7" })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Locations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Table 7" })).toBeVisible();
});
test("court QR preselection requires confirmation and allows validated override", async ({ page }) => {
  const { court, second } = await seedCourts();
  await page.goto(`/?court=${court}`);
  await page.getByRole("button", { name: "Ubah", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pilih lapangan" })).toHaveValue(court);
  await expect(page.getByText("Lapangan dikonfirmasi", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Konfirmasi lapangan" }).click();
  await expect(page.getByText("Lapangan dikonfirmasi", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Ubah", exact: true }).click();
  await page.getByRole("combobox", { name: "Pilih lapangan" }).selectOption(second);
  await page.getByRole("button", { name: "Konfirmasi lapangan" }).click();
  await expect(page).toHaveURL(new RegExp(`court=${second}`));
  await expect(page.getByText("Demo Sports Hall / Tennis 2", { exact: true })).toBeVisible();
  await pool.query("UPDATE location SET active = false WHERE id = $1", [second]);
  await page.getByRole("button", { name: "Muat ulang" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tautan QR tidak cocok" })).toBeVisible();
  await expect(page.getByText("Lapangan dikonfirmasi", { exact: false })).toHaveCount(0);
  await page.goto("/?court=unknown");
  await expect(page.getByRole("alert").filter({ hasText: "Tautan QR tidak cocok" })).toBeVisible();
});
test("preparation changes availability but cannot edit prices or directory", async ({ page }) => {
  const id = await seedMenu();
  await signIn(page, "prep"); await page.goto("/employee/menu");
  await expect(page.getByRole("button", { name: "Add menu item" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Locations", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Set Es kopi susu unavailable" }).click();
  await expect(page.getByRole("button", { name: "Set Es kopi susu available" })).toBeVisible();
  const denied = await page.request.patch("/api/employee/catalog/product", { headers: { origin: "http://127.0.0.1:3100" },
    data: { id, version: 2, available: true, priceIdr: 1 } });
  expect(denied.status()).toBe(400);
  await page.goto("/"); await expect(page.getByText("Habis sementara")).toBeVisible();
  await expect(page.getByText("Rp 28.000", { exact: true })).toBeVisible();
});
test("two browser drafts cannot silently overwrite and public network failures are explicit", async ({ page, context }) => {
  await seedMenu(); await signIn(page); await page.goto("/employee/menu");
  const second = await context.newPage(); await second.goto("/employee/menu");
  for (const editor of [page, second]) await editor.getByRole("button", { name: "Edit Es kopi susu" }).click();
  await page.getByLabel("Final price (IDR)").fill("32000"); await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Minuman · Rp 32.000")).toBeVisible();
  await second.getByLabel("Final price (IDR)").fill("1000"); await second.getByRole("button", { name: "Save changes" }).click();
  await expect(second.getByRole("alert").filter({ hasText: "Someone changed this record" })).toBeVisible();
  await expect(second.getByLabel("Final price (IDR)")).toHaveValue("1000");
  await second.close(); await page.goto("/"); await expect(page.getByText("Rp 32.000", { exact: true })).toBeVisible();
  await page.route("**/api/catalog**", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }));
  await page.getByRole("button", { name: "Muat ulang" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Menu belum bisa diperbarui" })).toBeVisible();
  await page.route("**/api/employee/catalog", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }));
  await page.goto("/employee/menu");
  await expect(page.getByRole("alert").filter({ hasText: "Menu management is unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add menu item" })).toHaveCount(0);
});
