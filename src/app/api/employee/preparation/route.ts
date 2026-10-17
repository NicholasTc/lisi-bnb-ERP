import { preparationAction, preparationQueue } from "@/server/preparation";
import { requireSameOrigin } from "@/server/auth-http";
import { handleRequest, json } from "@/server/http";
import { readJsonObject } from "@/server/request-body";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleRequest(async () => {
    const params = new URL(request.url).searchParams;
    return json(await preparationQueue(request.headers, params.get("state") ?? "awaiting_preparation", params.get("after")));
  });
}
export function POST(request: Request) {
  return handleRequest(async () => { requireSameOrigin(request); return json(await preparationAction(request.headers, await readJsonObject(request))); });
}
