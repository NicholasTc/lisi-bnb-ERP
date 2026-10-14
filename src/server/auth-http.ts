import "server-only";
import { readConfig } from "./config";
import { getAuth } from "./auth";
import { requireEmployee } from "./employee";
import { HttpError, json } from "./http";

export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== readConfig().origin) throw new HttpError(403, "INVALID_ORIGIN");
}
export async function authRequest(request: Request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/get-session" && request.method === "GET") {
    const employee = await requireEmployee(request.headers);
    return json({ user: employee.user, session: employee.session });
  }
  if (!(["/api/auth/sign-in/email", "/api/auth/sign-out"].includes(path) && request.method === "POST")) {
    throw new HttpError(404, "NOT_FOUND");
  }
  requireSameOrigin(request);
  // Only the explicitly approved authentication surface is exposed.
  const response = await getAuth().handler(request);
  response.headers.set("Cache-Control", "no-store");
  // Do not expose opaque session tokens in JSON; Better Auth sets the HttpOnly cookie.
  if (response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json();
    if (data && typeof data === "object") delete data.token;
    response.headers.delete("Content-Length");
    return new Response(JSON.stringify(data), { status: response.status, headers: response.headers });
  }
  return response;
}
