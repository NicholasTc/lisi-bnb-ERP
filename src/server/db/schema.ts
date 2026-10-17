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
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [check("employee_version_positive", sql`${t.version} > 0`), uniqueIndex("employee_email_normalized").on(sql`lower(btrim(${t.email}))`)]);
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
  check("employee_role_known", sql`${table.role} IN ('preparation', 'delivery', 'supervisor', 'owner', 'counter')`)]);

export const customerOrder = pgTable("customer_order", {
  id: text("id").primaryKey(), requestDigest: text("request_digest").notNull(), accessHash: text("access_hash").notNull().unique(),
  source: text("source").notNull(), createdBy: text("created_by").references(() => user.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(), phone: text("phone"), kind: text("kind").notNull(),
  locationId: text("location_id").references(() => location.id, { onDelete: "restrict" }), destination: text("destination").notNull(),
  totalIdr: integer("total_idr").notNull(), currency: text("currency").notNull().default("IDR"),
  evidenceMode: text("evidence_mode").notNull().default("demo"), state: text("state").notNull().default("awaiting_payment"), reason: text("reason"),
  preparationAssigneeId: text("preparation_assignee_id").references(() => user.id, { onDelete: "restrict" }),
  preparationClaimedAt: time("preparation_claimed_at"), preparationReadyAt: time("preparation_ready_at"),
  deliveryAssigneeId: text("delivery_assignee_id").references(() => user.id, { onDelete: "restrict" }),
  deliveryClaimedAt: time("delivery_claimed_at"), collectedAt: time("collected_at"), arrivedAt: time("arrived_at"),
  heldState: text("held_state"), incident: text("incident"), contactAttempt: text("contact_attempt"), returnedAt: time("returned_at"),
  unpaidHandoverAt: time("unpaid_handover_at"),
  effectiveLocationId: text("effective_location_id").references(() => location.id, { onDelete: "restrict" }), effectiveDestination: text("effective_destination"),
  operationVersion: integer("operation_version").notNull().default(1),
  publicReference: text("public_reference").unique(), demoTransactionId: text("demo_transaction_id").unique(), pickupCode: text("pickup_code").unique(),
  createdAt: time("created_at").notNull().defaultNow(), expiresAt: time("expires_at"), accessExpiresAt: time("access_expires_at").notNull(),
}, t => [check("order_amount_valid", sql`${t.totalIdr} > 0 AND ${t.currency} = 'IDR' AND ${t.evidenceMode} IN ('demo','court_test')`),
  check("order_source_valid", sql`(${t.source} = 'guest' AND ${t.createdBy} IS NULL) OR (${t.source} = 'counter' AND ${t.createdBy} IS NOT NULL)`),
  check("order_contact_valid", sql`length(btrim(${t.customerName})) BETWEEN 1 AND 120 AND (${t.kind} <> 'court' OR (${t.phone} IS NOT NULL AND length(${t.phone}) BETWEEN 8 AND 30))`),
  check("order_location_valid", sql`(${t.kind} = 'pickup' AND ${t.locationId} IS NULL AND ${t.pickupCode} IS NOT NULL) OR (${t.kind} IN ('court', 'dine_in') AND ${t.locationId} IS NOT NULL AND ${t.pickupCode} IS NULL)`),
  check("order_state_valid", sql`(${t.evidenceMode} = 'demo' AND ${t.state} IN ('awaiting_payment','queued_for_preparation','canceled','exception')) OR (${t.evidenceMode} = 'court_test' AND ${t.state} IN ('awaiting_preparation','preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover','unpaid_handover','canceled','exception'))`),
  check("court_workflow_valid", sql`(${t.evidenceMode} = 'demo' AND ${t.demoTransactionId} IS NOT NULL AND ${t.publicReference} IS NULL) OR (${t.evidenceMode} = 'court_test' AND ${t.source} = 'guest' AND ${t.kind} = 'court' AND ${t.demoTransactionId} IS NULL AND ${t.publicReference} IS NOT NULL AND ${t.publicReference} ~ '^LB-[A-F0-9]{10}$')`),
  check("order_deadlines_valid", sql`((${t.evidenceMode} = 'demo' AND ${t.expiresAt} IS NOT NULL AND ${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + interval '15 minutes') OR (${t.evidenceMode} = 'court_test' AND ${t.expiresAt} IS NULL)) AND ${t.accessExpiresAt} > ${t.createdAt} AND ${t.accessExpiresAt} <= ${t.createdAt} + interval '24 hours'`),
  check("operation_version_positive", sql`${t.operationVersion} > 0`),
  check("operation_review_valid", sql`(${t.heldState} IS NULL OR (${t.state} = 'exception' AND ${t.heldState} IN ('awaiting_preparation','preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover'))) AND (${t.incident} IS NULL OR ${t.incident} IN ('other','absent','refused')) AND (${t.incident} IS NULL OR ${t.state} IN ('exception','canceled'))`),
  check("operation_destination_valid", sql`(${t.effectiveLocationId} IS NULL AND ${t.effectiveDestination} IS NULL) OR (${t.evidenceMode} = 'court_test' AND ${t.effectiveLocationId} IS NOT NULL AND ${t.effectiveDestination} IS NOT NULL)`),
  index("preparation_queue_idx").on(t.evidenceMode, t.state, t.createdAt, t.id),
  index("order_created_idx").on(t.createdAt)]);
export const orderItem = pgTable("order_item", {
  orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "restrict" }),
  name: text("name").notNull(), nameEn: text("name_en"), description: text("description").notNull(), descriptionEn: text("description_en"),
  quantity: integer("quantity").notNull(), unitPriceIdr: integer("unit_price_idr").notNull(),
}, t => [primaryKey({ columns: [t.orderId, t.productId] }), check("order_item_amount_valid", sql`${t.quantity} BETWEEN 1 AND 99 AND ${t.unitPriceIdr} > 0`)]);
export const paymentTransaction = pgTable("payment_transaction", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  amountIdr: integer("amount_idr").notNull(), currency: text("currency").notNull().default("IDR"),
  matched: boolean("matched").notNull(), primary: boolean("is_primary").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("payment_amount_valid", sql`${t.amountIdr} > 0 AND ${t.currency} = 'IDR' AND (NOT ${t.primary} OR ${t.matched})`),
  uniqueIndex("one_primary_payment").on(t.orderId).where(sql`${t.primary} = true`), index("payment_order_idx").on(t.orderId)]);
export const refund = pgTable("refund", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  paymentId: text("payment_id").notNull().references(() => paymentTransaction.id, { onDelete: "restrict" }),
  amountIdr: integer("amount_idr").notNull(), state: text("state").notNull().default("pending"), reason: text("reason").notNull(),
  actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }), createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("refund_amount_valid", sql`${t.amountIdr} > 0 AND length(btrim(${t.reason})) BETWEEN 1 AND 200`),
  check("refund_state_valid", sql`${t.state} IN ('pending','succeeded','failed')`),
  uniqueIndex("one_live_full_refund").on(t.paymentId).where(sql`${t.state} IN ('pending','succeeded')`)]);
export const financialEvent = pgTable("financial_event", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  digest: text("digest").notNull(), payload: jsonb("payload").notNull(), result: text("result").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const demoInbox = pgTable("demo_inbox", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  digest: text("digest").notNull(), payload: jsonb("payload").notNull(), signature: text("signature").notNull(),
  actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }), createdAt: time("created_at").notNull().defaultNow(),
});
export const orderEvent = pgTable("order_event", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => customerOrder.id, { onDelete: "restrict" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(), detail: text("detail").notNull(), createdAt: time("created_at").notNull().defaultNow(),
});
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

// One durable court-ordering switch. Existing preparation continues during a pause.
export const courtService = pgTable("court_service", {
  id: integer("id").primaryKey(), paused: boolean("paused").notNull().default(false),
  reason: text("reason"), version: integer("version").notNull().default(1),
  deliveryPaused: boolean("delivery_paused").notNull().default(false), deliveryReason: text("delivery_reason"),
  actorId: text("actor_id").references(() => user.id, { onDelete: "restrict" }),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [check("court_service_singleton", sql`${t.id} = 1 AND ${t.version} > 0`),
  check("court_service_reason", sql`(${t.paused} AND length(btrim(${t.reason})) BETWEEN 1 AND 200 AND ${t.reason} IS NOT NULL) OR (NOT ${t.paused} AND ${t.reason} IS NULL)`)]);
export const preparationCommand = pgTable("preparation_command", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  orderId: text("order_id").references(() => customerOrder.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(), digest: text("digest").notNull(), reason: text("reason"),
  orderVersion: integer("order_version"), serviceVersion: integer("service_version"), createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("preparation_command_kind", sql`(${t.kind} IN ('claim','ready','hold') AND ${t.orderId} IS NOT NULL AND ${t.serviceVersion} IS NULL) OR (${t.kind} IN ('pause','resume') AND ${t.orderId} IS NULL AND ${t.serviceVersion} > 1 AND ${t.serviceVersion} IS NOT NULL)`),
  check("preparation_command_reason", sql`(${t.kind} IN ('hold','pause') AND ${t.reason} IS NOT NULL AND length(btrim(${t.reason})) BETWEEN 1 AND 200) OR (${t.kind} NOT IN ('hold','pause') AND ${t.reason} IS NULL)`),
  index("preparation_command_order_idx").on(t.orderId)]);

export const employeeCommand = pgTable("employee_command", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  targetId: text("target_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(), digest: text("digest").notNull(), detail: jsonb("detail").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("employee_command_kind", sql`${t.kind} IN ('create','edit','password_changed')`), index("employee_command_target_idx").on(t.targetId)]);

export const operationCommand = pgTable("operation_command", {
 id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }),
 orderId: text("order_id").references(() => customerOrder.id, { onDelete: "restrict" }), kind: text("kind").notNull(),
 digest: text("digest").notNull(), reason: text("reason"), physicalCheck: text("physical_check"),
 before: jsonb("before"), after: jsonb("after"), serviceVersion: integer("service_version"),
 createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("operation_command_kind", sql`${t.kind} IN ('claim','collect','arrive','hold','contact','return','resume','reassign','cancel','correct','unpaid_handover','pause_delivery','resume_delivery')`),
 index("operation_command_order_idx").on(t.orderId)]);
