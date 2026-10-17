ALTER TABLE "customer_order" DROP CONSTRAINT "order_amount_valid";--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "order_state_valid";--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "order_deadlines_valid";--> statement-breakpoint
ALTER TABLE "customer_order" ALTER COLUMN "demo_transaction_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "public_reference" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_public_reference_unique" UNIQUE("public_reference");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "court_workflow_valid" CHECK (("customer_order"."evidence_mode" = 'demo' AND "customer_order"."demo_transaction_id" IS NOT NULL AND "customer_order"."public_reference" IS NULL) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."source" = 'guest' AND "customer_order"."kind" = 'court' AND "customer_order"."demo_transaction_id" IS NULL AND "customer_order"."public_reference" IS NOT NULL AND "customer_order"."public_reference" ~ '^LB-[A-F0-9]{10}$'));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "order_amount_valid" CHECK ("customer_order"."total_idr" > 0 AND "customer_order"."currency" = 'IDR' AND "customer_order"."evidence_mode" IN ('demo','court_test'));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "order_state_valid" CHECK (("customer_order"."evidence_mode" = 'demo' AND "customer_order"."state" IN ('awaiting_payment','queued_for_preparation','canceled','exception')) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."state" IN ('awaiting_preparation','canceled','exception')));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "order_deadlines_valid" CHECK ((("customer_order"."evidence_mode" = 'demo' AND "customer_order"."expires_at" IS NOT NULL AND "customer_order"."expires_at" > "customer_order"."created_at" AND "customer_order"."expires_at" <= "customer_order"."created_at" + interval '15 minutes') OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."expires_at" IS NULL)) AND "customer_order"."access_expires_at" > "customer_order"."created_at" AND "customer_order"."access_expires_at" <= "customer_order"."created_at" + interval '24 hours');
--> statement-breakpoint
-- Preserve v1 payment-before-queue rules, but never let simulator records pay v2 court orders.
CREATE OR REPLACE FUNCTION check_primary_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale customer_order;
BEGIN
  SELECT * INTO STRICT sale FROM customer_order WHERE id = NEW.order_id FOR SHARE;
  IF sale.evidence_mode <> 'demo' THEN
    RAISE EXCEPTION 'Court payment verification is not implemented' USING ERRCODE = '23514';
  END IF;
  IF NEW.matched AND NEW.amount_idr <> sale.total_idr THEN
    RAISE EXCEPTION 'Matched amount differs' USING ERRCODE = '23514';
  END IF;
  IF NEW.is_primary AND (sale.state <> 'awaiting_payment' OR sale.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Closed order cannot receive preparation eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_preparation_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.evidence_mode = 'court_test' THEN
    IF TG_OP = 'INSERT' AND NEW.state <> 'awaiting_preparation' THEN
      RAISE EXCEPTION 'Court orders begin awaiting preparation' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.state = 'awaiting_preparation' AND OLD.state <> 'awaiting_preparation' THEN
      RAISE EXCEPTION 'Closed court order cannot be reopened' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.state = 'queued_for_preparation' AND NOT EXISTS (
    SELECT 1 FROM payment_transaction p WHERE p.order_id = NEW.id AND p.is_primary AND p.matched
      AND NOT EXISTS (SELECT 1 FROM refund r WHERE r.payment_id = p.id AND r.state IN ('pending','succeeded'))
  ) THEN RAISE EXCEPTION 'Preparation requires an accepted payment' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.state = 'queued_for_preparation' AND OLD.state NOT IN ('awaiting_payment','queued_for_preparation') THEN
    RAISE EXCEPTION 'Closed order cannot be released automatically' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION demo_order_evidence_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM customer_order WHERE id = NEW.order_id AND evidence_mode = 'demo' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo evidence requires a historical demo order' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER demo_inbox_only BEFORE INSERT ON demo_inbox FOR EACH ROW EXECUTE FUNCTION demo_order_evidence_only();
CREATE TRIGGER financial_event_demo_only BEFORE INSERT ON financial_event FOR EACH ROW EXECUTE FUNCTION demo_order_evidence_only();
