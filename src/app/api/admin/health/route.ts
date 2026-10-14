import { requireOwner } from "@/server/employee";
import { checkReadiness } from "@/server/health";
import { handleRequest, json } from "@/server/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleRequest(async () => {
  await requireOwner(request.headers);
  await checkReadiness();
  return json({ status: "ready" });
}); }
