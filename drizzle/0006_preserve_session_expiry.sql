ALTER TABLE "customer_order" ALTER COLUMN "expires_at" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET NOT NULL;
