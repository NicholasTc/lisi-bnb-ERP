import { checkReadiness } from "@/server/health";
import { handleRequest, json } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return handleRequest(async () => { await checkReadiness(); return json({ status: "ready" }); }); }
