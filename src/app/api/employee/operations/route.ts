import {operationAction,operationQueue} from "@/server/operations";
import {requireSameOrigin} from "@/server/auth-http";
import {handleRequest,json} from "@/server/http";
import {readJsonObject} from "@/server/request-body";
export const dynamic="force-dynamic";
export function GET(request:Request){return handleRequest(async()=>{const p=new URL(request.url).searchParams;return json(await operationQueue(request.headers,p.get("tab")??"ready",p.get("after")));});}
export function POST(request:Request){return handleRequest(async()=>{requireSameOrigin(request);return json(await operationAction(request.headers,await readJsonObject(request)));});}
