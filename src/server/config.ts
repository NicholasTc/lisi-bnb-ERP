export type AppEnvironment = "development" | "test" | "production";
export interface AppConfig {
  environment: AppEnvironment;
  databaseUrl: string;
  authSecret: string;
  origin: string;
}

export function assertLocalDatabase(urlString: string, environment: "development" | "test") {
  let url: URL;
  try { url = new URL(urlString); } catch { throw new Error("Invalid database configuration"); }
  const suffix = environment === "test" ? "test" : "dev";
  const port = environment === "test" ? "55433" : "55432";
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.port !== port || url.pathname !== `/lisi_${suffix}` ||
      decodeURIComponent(url.username) !== `lisi_${suffix}` || !url.password || url.search || url.hash) {
    throw new Error(`Database must be the dedicated local ${environment} database`);
  }
}

export function readConfig(source: Readonly<Record<string, string | undefined>> = process.env): AppConfig {
  const environment = source.APP_ENV;
  if (environment !== "development" && environment !== "test" && environment !== "production") {
    throw new Error("APP_ENV must be explicit");
  }
  if (source.PAYMENTS_MODE !== "disabled" ||
      Object.keys(source).some(key => /^(PAYMENT_|PAYMENTS_|QRIS_)/.test(key) && key !== "PAYMENTS_MODE" && source[key])) {
    throw new Error("Payment integration is disabled in Milestone 1");
  }
  const databaseUrl = source.DATABASE_URL;
  const authSecret = source.BETTER_AUTH_SECRET;
  const rawOrigin = source.APP_ORIGIN;
  if (!databaseUrl || !authSecret || authSecret.length < 32 || /[<>]/.test(authSecret) || !rawOrigin) {
    throw new Error("Missing or invalid server configuration");
  }
  let origin: URL;
  try { origin = new URL(rawOrigin); } catch { throw new Error("Invalid application origin"); }
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("Application origin must contain only scheme, host and port");
  }
  if (environment !== "production") {
    assertLocalDatabase(databaseUrl, environment);
    if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1") {
      throw new Error("Local environment must use a loopback application origin");
    }
  } else {
    const database = new URL(databaseUrl);
    if (origin.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
        !["postgres:", "postgresql:"].includes(database.protocol) || !database.password ||
        ["/lisi_dev", "/lisi_test"].includes(database.pathname) ||
        !["require", "verify-full"].includes(database.searchParams.get("sslmode") ?? "")) {
      throw new Error("Production requires HTTPS and a separate encrypted database connection");
    }
  }
  return { environment, databaseUrl, authSecret, origin: origin.origin };
}
