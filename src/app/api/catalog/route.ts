import { publicCatalog } from "@/server/catalog";
import { handleRequest, json } from "@/server/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleRequest(async () => json(await publicCatalog(new URL(request.url).searchParams.get("court")))); }
