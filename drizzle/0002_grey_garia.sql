CREATE TABLE "building" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_name_valid" CHECK (length(btrim("building"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "building_version_positive" CHECK ("building"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_event_entity_valid" CHECK ("catalog_event"."entity" IN ('product', 'building', 'location'))
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"table_number" integer,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_kind_valid" CHECK ("location"."kind" IN ('court', 'table')),
	CONSTRAINT "location_name_valid" CHECK (length(btrim("location"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "location_table_number_valid" CHECK (("location"."kind" = 'court' AND "location"."table_number" IS NULL) OR ("location"."kind" = 'table' AND "location"."table_number" IS NOT NULL AND "location"."table_number" > 0 AND "location"."name" = "location"."table_number"::text)),
	CONSTRAINT "location_version_positive" CHECK ("location"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"description" text DEFAULT '' NOT NULL,
	"description_en" text,
	"category" text NOT NULL,
	"category_en" text,
	"price_idr" integer NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_price_nonnegative" CHECK ("product"."price_idr" >= 0),
	CONSTRAINT "product_version_positive" CHECK ("product"."version" > 0),
	CONSTRAINT "product_name_valid" CHECK (length(btrim("product"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "product_category_valid" CHECK (length(btrim("product"."category")) BETWEEN 1 AND 60),
	CONSTRAINT "product_description_valid" CHECK (length("product"."description") <= 500),
	CONSTRAINT "product_translation_valid" CHECK (("product"."name_en" IS NULL OR length(btrim("product"."name_en")) BETWEEN 1 AND 120) AND ("product"."category_en" IS NULL OR length(btrim("product"."category_en")) BETWEEN 1 AND 60) AND ("product"."description_en" IS NULL OR length("product"."description_en") <= 500))
);
--> statement-breakpoint
ALTER TABLE "catalog_event" ADD CONSTRAINT "catalog_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "building_name_unique" ON "building" USING btree (lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "catalog_event_entity_idx" ON "catalog_event" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_name_unique" ON "location" USING btree ("building_id","kind",lower(btrim("name")));