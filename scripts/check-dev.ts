import { chromium, expect } from "@playwright/test";

// Observe the already-running local app; no account, order, or database fixtures/writes.
// Packaged E2E tests do not exercise the development server's hot-reload connection.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let navigations = 0, catalogRequests = 0;
  const errors: string[] = [];
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/catalog") catalogRequests++; });
  page.on("pageerror", error => errors.push(error.message));
  const catalog = page.waitForResponse(response => new URL(response.url()).pathname === "/api/catalog");
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect((await catalog).status()).toBe(200);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today's menu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  const initialNavigations = navigations, initialRequests = catalogRequests;
  // The previous failure reloaded hundreds of times here, preventing hydration/menu use.
  await page.waitForTimeout(6000);
  expect(navigations, "The development page must not spontaneously reload").toBe(initialNavigations);
  expect(catalogRequests, "The menu must not be repeatedly fetched by a reload loop").toBe(initialRequests);
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/catalog");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  expect(errors, "No browser JavaScript errors").toEqual([]);
  console.log("Development browser smoke check passed: menu loaded, no repeated reload/fetch, language retained, refresh works.");
} finally {
  await browser.close();
}
