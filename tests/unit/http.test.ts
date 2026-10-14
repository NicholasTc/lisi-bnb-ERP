import { describe, expect, it, vi } from "vitest";
import { handleRequest, HttpError } from "../../src/server/http";
import { canReadOwnerDiagnostic, isRole } from "../../src/server/roles";
describe("safe errors and default-deny authorization", () => {
  it("does not leak unexpected error details into logs or responses", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleRequest(async () => { throw new Error("PRIVATE_DATABASE_DETAIL"); });
      const body = await response.text();
      expect(response.status).toBe(500);
      expect(body).not.toContain("PRIVATE_DATABASE_DETAIL");
      expect(JSON.stringify(spy.mock.calls)).not.toContain("PRIVATE_DATABASE_DETAIL");
      expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally { spy.mockRestore(); }
  });
  it("preserves expected forbidden status", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await handleRequest(async () => { throw new HttpError(403, "FORBIDDEN"); })).status).toBe(403); }
    finally { spy.mockRestore(); }
  });
  it("does not infer owner from other roles or empty assignments", () => {
    expect(canReadOwnerDiagnostic([])).toBe(false);
    expect(canReadOwnerDiagnostic(["supervisor", "delivery"])).toBe(false);
    expect(canReadOwnerDiagnostic(["owner", "preparation"])).toBe(true);
    expect(isRole("administrator")).toBe(false);
  });
});
