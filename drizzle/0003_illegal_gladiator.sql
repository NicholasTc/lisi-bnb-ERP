CREATE TABLE "customer_order" (
	"id" text PRIMARY KEY NOT NULL,
	"request_digest" text NOT NULL,
	"access_hash" text NOT NULL,
	"source" text NOT NULL,
	"created_by" text,
	"customer_name" text NOT NULL,
	"phone" text,
	"kind" text NOT NULL,
	"location_id" text,
	"destination" text NOT NULL,
	"total_idr" integer NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"evidence_mode" text DEFAULT 'demo' NOT NULL,
	"state" text DEFAULT 'awaiting_payment' NOT NULL,
	"reason" text,
	"demo_transaction_id" text NOT NULL,
	"pickup_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_order_access_hash_unique" UNIQUE("access_hash"),
	CONSTRAINT "customer_order_demo_transaction_id_unique" UNIQUE("demo_transaction_id"),
	CONSTRAINT "customer_order_pickup_code_unique" UNIQUE("pickup_code"),
	CONSTRAINT "order_amount_valid" CHECK ("customer_order"."total_idr" > 0 AND "customer_order"."currency" = 'IDR' AND "customer_order"."evidence_mode" = 'demo'),
	CONSTRAINT "order_source_valid" CHECK (("customer_order"."source" = 'guest' AND "customer_order"."created_by" IS NULL) OR ("customer_order"."source" = 'counter' AND "customer_order"."created_by" IS NOT NULL)),
	CONSTRAINT "order_contact_valid" CHECK (length(btrim("customer_order"."customer_name")) BETWEEN 1 AND 120 AND ("customer_order"."kind" <> 'court' OR ("customer_order"."phone" IS NOT NULL AND length("customer_order"."phone") BETWEEN 8 AND 30))),
	CONSTRAINT "order_location_valid" CHECK (("customer_order"."kind" = 'pickup' AND "customer_order"."location_id" IS NULL AND "customer_order"."pickup_code" IS NOT NULL) OR ("customer_order"."kind" IN ('court', 'dine_in') AND "customer_order"."location_id" IS NOT NULL AND "customer_order"."pickup_code" IS NULL)),
	CONSTRAINT "order_state_valid" CHECK ("customer_order"."state" IN ('awaiting_payment','queued_for_preparation','canceled','exception')),
	CONSTRAINT "order_deadlines_valid" CHECK ("customer_order"."expires_at" > "customer_order"."created_at" AND "customer_order"."expires_at" <= "customer_order"."created_at" + interval '15 minutes' AND "customer_order"."access_expires_at" > "customer_order"."created_at" AND "customer_order"."access_expires_at" <= "customer_order"."created_at" + interval '24 hours')
);
--> statement-breakpoint
CREATE TABLE "demo_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"digest" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_event" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"digest" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"description" text NOT NULL,
	"description_en" text,
	"quantity" integer NOT NULL,
	"unit_price_idr" integer NOT NULL,
	CONSTRAINT "order_item_order_id_product_id_pk" PRIMARY KEY("order_id","product_id"),
	CONSTRAINT "order_item_amount_valid" CHECK ("order_item"."quantity" BETWEEN 1 AND 99 AND "order_item"."unit_price_idr" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"amount_idr" integer NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"matched" boolean NOT NULL,
	"is_primary" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount_valid" CHECK ("payment_transaction"."amount_idr" > 0 AND "payment_transaction"."currency" = 'IDR' AND (NOT "payment_transaction"."is_primary" OR "payment_transaction"."matched"))
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"amount_idr" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_amount_valid" CHECK ("refund"."amount_idr" > 0 AND length(btrim("refund"."reason")) BETWEEN 1 AND 200),
	CONSTRAINT "refund_state_valid" CHECK ("refund"."state" IN ('pending','succeeded','failed'))
);
--> statement-breakpoint
ALTER TABLE "employee_role" DROP CONSTRAINT "employee_role_known";--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_inbox" ADD CONSTRAINT "demo_inbox_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_inbox" ADD CONSTRAINT "demo_inbox_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_event" ADD CONSTRAINT "financial_event_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_transaction_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_created_idx" ON "customer_order" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_primary_payment" ON "payment_transaction" USING btree ("order_id") WHERE "payment_transaction"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment_transaction" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_live_full_refund" ON "refund" USING btree ("payment_id") WHERE "refund"."state" IN ('pending','succeeded');--> statement-breakpoint
ALTER TABLE "employee_role" ADD CONSTRAINT "employee_role_known" CHECK ("employee_role"."role" IN ('preparation', 'delivery', 'supervisor', 'owner', 'counter'));