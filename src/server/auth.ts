import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { readConfig } from "./config";
import { getDb } from "./db/client";
import * as schema from "./db/schema";

let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  const config = readConfig();
  const db = getDb();
  return betterAuth({
    appName: "LISI BNB ERP",
    baseURL: config.origin,
    secret: config.authSecret,
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    user: { additionalFields: { enabled: { type: "boolean", defaultValue: false, input: false } } },
    session: { expiresIn: 8 * 60 * 60, disableSessionRefresh: true, cookieCache: { enabled: false } },
    trustedOrigins: [config.origin],
    advanced: {
      useSecureCookies: config.environment === "production",
      // No client-supplied proxy headers are trusted before production proxy review.
      ipAddress: { ipAddressHeaders: [] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 } } },
    databaseHooks: { session: { create: { before: async (candidate) => {
      const employees = await db.select({ enabled: schema.user.enabled }).from(schema.user).where(eq(schema.user.id, candidate.userId));
      if (!employees[0]?.enabled) throw new APIError("UNAUTHORIZED", { message: "Invalid email or password" });
      // The migration trigger also checks under a row lock, closing the disable/login race.
    } } } },
    logger: { log: (level) => {
      if (level === "error" || level === "warn") console.error(JSON.stringify({ level, code: "AUTH_LIBRARY_EVENT" }));
    } },
    telemetry: { enabled: false },
  });
}
export function getAuth() { return instance ??= createAuth(); }
