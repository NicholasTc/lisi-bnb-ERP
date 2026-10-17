import { requireSameOrigin } from "@/server/auth-http";
import { staffOrder } from "@/server/orders";
import { requestFullRefund } from "@/server/payment-processing";
import { deliverDemoEvent, issueDemoEvent, reconcileDemoEvents } from "@/server/demo-payments";
import { handleRequest, HttpError, json } from "@/server/http";
import { requireDemo } from "@/server/order-db";
import { readJsonObject } from "@/server/request-body";
import { checkKeys } from "@/server/catalog-input";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return handleRequest(async () => {
    requireDemo(); requireSameOrigin(request);
    const action = (await context.params).action, body = await readJsonObject(request);
    switch (action) {
      case "create": throw new HttpError(404, "PHASE_2_UNAVAILABLE");
      case "read": return json(await staffOrder(request.headers, body));
      case "cancel": return json(await staffOrder(request.headers, body, true));
      case "event": return json(await issueDemoEvent(request.headers, body));
      case "refund": return json(await requestFullRefund(request.headers, body));
      case "deliver": checkKeys(body, ["eventId"]); return json(await deliverDemoEvent(request.headers, body.eventId));
      case "reconcile": checkKeys(body, []); return json(await reconcileDemoEvents(request.headers));
      default: throw new HttpError(404, "NOT_FOUND");
    }
  });
}
