import { requireEmployee } from "@/server/employee";
import { handleRequest, json } from "@/server/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleRequest(async () => json(await requireEmployee(request.headers))); }
