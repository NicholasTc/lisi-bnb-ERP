import { requireSameOrigin } from "@/server/auth-http";
import { requireEmployee } from "@/server/employee";
import { handleRequest, json } from "@/server/http";
export function POST(request: Request) { return handleRequest(async () => {
  requireSameOrigin(request);
  await requireEmployee(request.headers, true);
  return json({ status: "ok" });
}); }
