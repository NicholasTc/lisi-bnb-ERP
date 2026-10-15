import { staffCatalog } from "@/server/catalog";
import { handleRequest, json } from "@/server/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleRequest(async () => json(await staffCatalog(request.headers))); }
