import { changeEmployeePassword } from "@/server/team";
import { requireSameOrigin } from "@/server/auth-http";
import { handleRequest, json } from "@/server/http";
import { readJsonObject } from "@/server/request-body";
export function POST(request:Request){return handleRequest(async()=>{requireSameOrigin(request);return json(await changeEmployeePassword(request.headers,await readJsonObject(request)));});}
