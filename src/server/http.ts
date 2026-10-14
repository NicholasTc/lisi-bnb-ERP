import "server-only";
import { randomUUID } from "node:crypto";

export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export async function handleRequest(operation: () => Promise<Response>) {
  const requestId = randomUUID();
  try {
    const response = await operation();
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    const expected = error instanceof HttpError;
    const code = expected ? error.code : "INTERNAL_ERROR";
    console.error(JSON.stringify({ level: expected ? "warn" : "error", code, requestId }));
    const response = json({ error: { code, requestId } }, expected ? error.status : 500);
    response.headers.set("X-Request-Id", requestId);
    return response;
  }
}
