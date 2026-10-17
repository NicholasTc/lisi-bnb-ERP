import { requireSameOrigin } from "@/server/auth-http";
import { createCourtOrder, guestOrder } from "@/server/orders";
import { handleRequest, HttpError, json } from "@/server/http";
import { requireOrdering } from "@/server/order-db";
import { readJsonObject } from "@/server/request-body";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return handleRequest(async () => {
    requireOrdering(); requireSameOrigin(request);
    const action = (await context.params).action;
    if (!["create", "read", "cancel"].includes(action)) throw new HttpError(404, "NOT_FOUND");
    const body = await readJsonObject(request);
    return json(action === "create" ? await createCourtOrder(body) : await guestOrder(body, action === "cancel"), action === "create" ? 201 : 200);
  });
}
