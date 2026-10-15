import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, bigint, jsonb } from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
  lastActivityAt: time("last_activity_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, table => [index("session_user_idx").on(table.userId),
  check("session_absolute_lifetime", sql`${table.expiresAt} > ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + interval '8 hours'`)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: time("access_token_expires_at"), refreshTokenExpiresAt: time("refresh_token_expires_at"),
  scope: text("scope"), password: text("password"),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
}, table => [uniqueIndex("account_provider_identity").on(table.providerId, table.accountId), index("account_user_idx").on(table.userId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
});
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(), key: text("key").notNull().unique(),
  count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull(),
}, table => [check("rate_limit_nonnegative", sql`${table.count} >= 0`)]);
export const employeeRole = pgTable("employee_role", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.role] }),
  check("employee_role_known", sql`${table.role} IN ('preparation', 'delivery', 'supervisor', 'owner')`)]);
export const environmentMarker = pgTable("environment_marker", {
  id: integer("id").primaryKey(), environment: text("environment").notNull(),
}, table => [check("single_environment", sql`${table.id} = 1`),
  check("known_environment", sql`${table.environment} IN ('development', 'test', 'production')`)]);

export const product = pgTable("product", {
  id: text("id").primaryKey(), name: text("name").notNull(), nameEn: text("name_en"),
  description: text("description").notNull().default(""), descriptionEn: text("description_en"),
  category: text("category").notNull(), categoryEn: text("category_en"),
  priceIdr: integer("price_idr").notNull(), available: boolean("available").notNull().default(true),
  active: boolean("active").notNull().default(true), version: integer("version").notNull().default(1),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, table => [check("product_price_nonnegative", sql`${table.priceIdr} >= 0`),
  check("product_version_positive", sql`${table.version} > 0`),
  check("product_name_valid", sql`length(btrim(${table.name})) BETWEEN 1 AND 120`),
  check("product_category_valid", sql`length(btrim(${table.category})) BETWEEN 1 AND 60`),
  check("product_description_valid", sql`length(${table.description}) <= 500`),
  check("product_translation_valid", sql`(${table.nameEn} IS NULL OR length(btrim(${table.nameEn})) BETWEEN 1 AND 120) AND (${table.categoryEn} IS NULL OR length(btrim(${table.categoryEn})) BETWEEN 1 AND 60) AND (${table.descriptionEn} IS NULL OR length(${table.descriptionEn}) <= 500)`)]);
export const building = pgTable("building", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  active: boolean("active").notNull().default(true), version: integer("version").notNull().default(1),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, table => [uniqueIndex("building_name_unique").on(sql`lower(btrim(${table.name}))`),
  check("building_name_valid", sql`length(btrim(${table.name})) BETWEEN 1 AND 120`),
  check("building_version_positive", sql`${table.version} > 0`)]);
export const location = pgTable("location", {
  id: text("id").primaryKey(), buildingId: text("building_id").notNull().references(() => building.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(), name: text("name").notNull(), tableNumber: integer("table_number"),
  active: boolean("active").notNull().default(true), version: integer("version").notNull().default(1),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, table => [uniqueIndex("location_name_unique").on(table.buildingId, table.kind, sql`lower(btrim(${table.name}))`),
  check("location_kind_valid", sql`${table.kind} IN ('court', 'table')`),
  check("location_name_valid", sql`length(btrim(${table.name})) BETWEEN 1 AND 120`),
  check("location_table_number_valid", sql`(${table.kind} = 'court' AND ${table.tableNumber} IS NULL) OR (${table.kind} = 'table' AND ${table.tableNumber} IS NOT NULL AND ${table.tableNumber} > 0 AND ${table.name} = ${table.tableNumber}::text)`),
  check("location_version_positive", sql`${table.version} > 0`)]);
export const catalogEvent = pgTable("catalog_event", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  entity: text("entity").notNull(), entityId: text("entity_id").notNull(),
  before: jsonb("before"), after: jsonb("after").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, table => [index("catalog_event_entity_idx").on(table.entity, table.entityId),
  check("catalog_event_entity_valid", sql`${table.entity} IN ('product', 'building', 'location')`)]);
