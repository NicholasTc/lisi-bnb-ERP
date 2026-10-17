import { teamList, teamAction } from "@/server/team";
import { requireSameOrigin } from "@/server/auth-http";
import { handleRequest, json } from "@/server/http";
import { readJsonObject } from "@/server/request-body";
export const dynamic="force-dynamic";
export function GET(request:Request){return handleRequest(async()=>{const p=new URL(request.url).searchParams;return json(await teamList(request.headers,p.get("search")??"",p.get("after")));});}
export function POST(request:Request){return handleRequest(async()=>{requireSameOrigin(request);return json(await teamAction(request.headers,await readJsonObject(request)));});}
