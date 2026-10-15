import { describe, expect, it } from "vitest";
import { readJsonObject } from "../../src/server/request-body";

const request = (body: string, contentType = "application/json") => new Request("http://127.0.0.1/catalog", {
  method: "POST", headers: { "Content-Type": contentType }, body,
});
describe("bounded catalog input", () => {
  it("accepts a JSON object with a charset", async () => {
    await expect(readJsonObject(request('{"name":"Café"}', "application/json; charset=utf-8")))
      .resolves.toEqual({ name: "Café" });
  });
  it("rejects unsupported content types, invalid JSON and non-object bodies", async () => {
    await expect(readJsonObject(request("{}", "text/plain"))).rejects.toMatchObject({ status: 415 });
    for (const body of ["", "{", "[]", "null", "123"]) {
      await expect(readJsonObject(request(body))).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
    }
  });
  it("limits actual UTF-8 bytes even without a content-length header", async () => {
    await expect(readJsonObject(request(JSON.stringify({ name: "é".repeat(9000) }))))
      .rejects.toMatchObject({ status: 413, code: "BODY_TOO_LARGE" });
  });
});
