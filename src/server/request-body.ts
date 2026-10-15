import "server-only";
import { HttpError } from "./http";

/** Catalog forms are small; bound actual bytes, not just the supplied header. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new HttpError(415, "JSON_REQUIRED");
  }
  const maximum = 16_384;
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maximum) throw new HttpError(413, "BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new HttpError(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Not an object");
    return body;
  } catch { throw new HttpError(400, "INVALID_JSON"); }
}
