import { staffOrders } from "@/server/orders";
import { handleRequest, json } from "@/server/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleRequest(async () => json(await staffOrders(request.headers, new URL(request.url).searchParams.get("before")))); }
