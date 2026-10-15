import { saveCatalog } from "@/server/catalog";
import { entityField } from "@/server/catalog-input";
import { requireSameOrigin } from "@/server/auth-http";
import { handleRequest, json } from "@/server/http";
import { readJsonObject } from "@/server/request-body";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ entity: string }> };
function save(request: Request, context: Context, create: boolean) {
  return handleRequest(async () => {
    requireSameOrigin(request);
    const entity = entityField((await context.params).entity);
    return json(await saveCatalog(request.headers, entity, await readJsonObject(request), create), create ? 201 : 200);
  });
}
export const POST = (request: Request, context: Context) => save(request, context, true);
export const PATCH = (request: Request, context: Context) => save(request, context, false);
