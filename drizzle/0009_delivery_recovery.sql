CREATE TABLE "operation_command" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"order_id" text,
	"kind" text NOT NULL,
	"digest" text NOT NULL,
	"reason" text,
	"physical_check" text,
	"before" jsonb,
	"after" jsonb,
	"service_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_command_kind" CHECK ("operation_command"."kind" IN ('claim','collect','arrive','hold','contact','return','resume','reassign','cancel','correct','unpaid_handover','pause_delivery','resume_delivery'))
);
--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "preparation_fields_valid";--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "order_state_valid";--> statement-breakpoint
ALTER TABLE "court_service" ADD COLUMN "delivery_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "court_service" ADD COLUMN "delivery_reason" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "delivery_assignee_id" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "delivery_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "collected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "held_state" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "incident" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "contact_attempt" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "unpaid_handover_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "effective_location_id" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "effective_destination" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "operation_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "operation_command" ADD CONSTRAINT "operation_command_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_command" ADD CONSTRAINT "operation_command_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operation_command_order_idx" ON "operation_command" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_delivery_assignee_id_user_id_fk" FOREIGN KEY ("delivery_assignee_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_effective_location_id_location_id_fk" FOREIGN KEY ("effective_location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "operation_version_positive" CHECK ("customer_order"."operation_version" > 0);--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "operation_review_valid" CHECK (("customer_order"."held_state" IS NULL OR ("customer_order"."state" = 'exception' AND "customer_order"."held_state" IN ('awaiting_preparation','preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover'))) AND ("customer_order"."incident" IS NULL OR "customer_order"."incident" IN ('other','absent','refused')) AND ("customer_order"."incident" IS NULL OR "customer_order"."state" IN ('exception','canceled')));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "operation_destination_valid" CHECK (("customer_order"."effective_location_id" IS NULL AND "customer_order"."effective_destination" IS NULL) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."effective_location_id" IS NOT NULL AND "customer_order"."effective_destination" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "order_state_valid" CHECK (("customer_order"."evidence_mode" = 'demo' AND "customer_order"."state" IN ('awaiting_payment','queued_for_preparation','canceled','exception')) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."state" IN ('awaiting_preparation','preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover','unpaid_handover','canceled','exception')));
--> statement-breakpoint
ALTER TABLE preparation_command ADD COLUMN order_version integer;
--> statement-breakpoint
CREATE TRIGGER immutable_operation_command BEFORE UPDATE ON operation_command FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
ALTER TABLE court_service ADD CONSTRAINT delivery_pause_reason CHECK (
 (delivery_paused AND delivery_reason IS NOT NULL AND length(btrim(delivery_reason)) BETWEEN 1 AND 200) OR
 (NOT delivery_paused AND delivery_reason IS NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mutable text[] := ARRAY['state','reason','expires_at','access_expires_at','preparation_assignee_id','preparation_claimed_at','preparation_ready_at',
 'delivery_assignee_id','delivery_claimed_at','collected_at','arrived_at','held_state','incident','contact_attempt','returned_at','unpaid_handover_at','effective_location_id','effective_destination','operation_version'];
BEGIN
 IF (to_jsonb(NEW)-mutable) IS DISTINCT FROM (to_jsonb(OLD)-mutable)
 OR NEW.expires_at>OLD.expires_at OR NEW.access_expires_at>OLD.access_expires_at THEN
 RAISE EXCEPTION 'Order snapshot cannot be rewritten' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_preparation_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.evidence_mode='court_test' THEN
  IF TG_OP='INSERT' AND NEW.state<>'awaiting_preparation' THEN RAISE EXCEPTION 'Court orders begin awaiting preparation' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.state='queued_for_preparation' AND NOT EXISTS (SELECT 1 FROM payment_transaction p WHERE p.order_id=NEW.id AND p.is_primary AND p.matched
  AND NOT EXISTS (SELECT 1 FROM refund r WHERE r.payment_id=p.id AND r.state IN ('pending','succeeded'))) THEN
  RAISE EXCEPTION 'Preparation requires accepted payment' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.state='queued_for_preparation' AND OLD.state NOT IN ('awaiting_payment','queued_for_preparation') THEN
  RAISE EXCEPTION 'Closed demo cannot reopen' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_preparation_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE changed boolean; stage text;
BEGIN
 IF NEW.evidence_mode<>'court_test' THEN
  IF NEW.preparation_assignee_id IS NOT NULL OR NEW.preparation_claimed_at IS NOT NULL OR NEW.preparation_ready_at IS NOT NULL OR NEW.delivery_assignee_id IS NOT NULL OR NEW.delivery_claimed_at IS NOT NULL OR NEW.collected_at IS NOT NULL OR NEW.arrived_at IS NOT NULL OR NEW.held_state IS NOT NULL OR NEW.incident IS NOT NULL OR NEW.contact_attempt IS NOT NULL OR NEW.returned_at IS NOT NULL OR NEW.unpaid_handover_at IS NOT NULL OR NEW.effective_location_id IS NOT NULL OR NEW.operation_version<>1 THEN
   RAISE EXCEPTION 'Operations require court provenance' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' AND (NEW.preparation_assignee_id IS NOT NULL OR NEW.preparation_claimed_at IS NOT NULL OR NEW.preparation_ready_at IS NOT NULL OR NEW.delivery_assignee_id IS NOT NULL OR NEW.delivery_claimed_at IS NOT NULL OR NEW.collected_at IS NOT NULL OR NEW.arrived_at IS NOT NULL OR NEW.returned_at IS NOT NULL OR NEW.held_state IS NOT NULL OR NEW.incident IS NOT NULL OR NEW.contact_attempt IS NOT NULL OR NEW.effective_location_id IS NOT NULL OR NEW.unpaid_handover_at IS NOT NULL OR NEW.operation_version<>1) THEN RAISE EXCEPTION 'Court orders begin without task history' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.operation_version<>OLD.operation_version THEN RAISE EXCEPTION 'Order version is server owned' USING ERRCODE='23514'; END IF;
  IF NEW.state='exception' AND OLD.state<>'exception' THEN NEW.held_state:=OLD.state; END IF;
  changed := (to_jsonb(NEW)-ARRAY['expires_at','access_expires_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['expires_at','access_expires_at']);
  IF changed THEN
   IF OLD.state IN ('canceled','unpaid_handover') THEN RAISE EXCEPTION 'Closed court work cannot change' USING ERRCODE='23514'; END IF;
   NEW.operation_version:=OLD.operation_version+1;
  END IF;
  IF NEW.state<>OLD.state AND NOT (
   (OLD.state='awaiting_preparation' AND NEW.state IN ('preparing','exception','canceled')) OR
   (OLD.state='preparing' AND NEW.state IN ('ready','exception','canceled')) OR
   (OLD.state='ready' AND NEW.state IN ('delivery_claimed','exception','canceled')) OR
   (OLD.state='delivery_claimed' AND NEW.state IN ('out_for_delivery','exception','canceled')) OR
   (OLD.state='out_for_delivery' AND NEW.state IN ('awaiting_handover','exception','canceled')) OR
   (OLD.state='awaiting_handover' AND NEW.state IN ('exception','canceled','unpaid_handover')) OR
   (OLD.state='exception' AND NEW.state IN ('awaiting_preparation','preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover','canceled','unpaid_handover'))
  ) THEN RAISE EXCEPTION 'Invalid court transition' USING ERRCODE='23514'; END IF;
 END IF;
 stage:=CASE WHEN NEW.state='exception' THEN coalesce(NEW.held_state,CASE WHEN NEW.preparation_assignee_id IS NULL THEN 'awaiting_preparation' ELSE 'preparing' END) ELSE NEW.state END;
 IF stage IN ('preparing','ready','delivery_claimed','out_for_delivery','awaiting_handover','unpaid_handover') AND
  (NEW.preparation_assignee_id IS NULL OR NEW.preparation_claimed_at IS NULL) THEN RAISE EXCEPTION 'Preparation assignment required' USING ERRCODE='23514'; END IF;
 IF stage IN ('ready','delivery_claimed','out_for_delivery','awaiting_handover','unpaid_handover') AND NEW.preparation_ready_at IS NULL THEN
  RAISE EXCEPTION 'Prepared drinks required' USING ERRCODE='23514'; END IF;
 IF stage IN ('delivery_claimed','out_for_delivery','awaiting_handover','unpaid_handover') AND (NEW.delivery_assignee_id IS NULL OR NEW.delivery_claimed_at IS NULL) THEN
  RAISE EXCEPTION 'Delivery assignment required' USING ERRCODE='23514'; END IF;
 IF stage IN ('out_for_delivery','awaiting_handover','unpaid_handover') AND NEW.collected_at IS NULL THEN RAISE EXCEPTION 'Collection required' USING ERRCODE='23514'; END IF;
 IF stage IN ('awaiting_handover','unpaid_handover') AND NEW.arrived_at IS NULL THEN RAISE EXCEPTION 'Arrival required' USING ERRCODE='23514'; END IF;
 IF (NEW.preparation_claimed_at<NEW.created_at) OR (NEW.preparation_ready_at<NEW.preparation_claimed_at) OR
  (NEW.delivery_claimed_at<NEW.preparation_ready_at) OR (NEW.collected_at<NEW.delivery_claimed_at) OR
  (NEW.arrived_at<NEW.collected_at) OR (NEW.returned_at<NEW.collected_at) THEN RAISE EXCEPTION 'Invalid physical timestamps' USING ERRCODE='23514'; END IF;
 IF (NEW.preparation_ready_at IS NOT NULL AND NEW.preparation_claimed_at IS NULL) OR (NEW.delivery_claimed_at IS NOT NULL AND NEW.preparation_ready_at IS NULL) OR (NEW.collected_at IS NOT NULL AND NEW.delivery_claimed_at IS NULL) OR (NEW.arrived_at IS NOT NULL AND NEW.collected_at IS NULL) OR (NEW.returned_at IS NOT NULL AND NEW.collected_at IS NULL) THEN RAISE EXCEPTION 'Incomplete physical history' USING ERRCODE='23514'; END IF;
 IF NEW.preparation_assignee_id IS NULL AND (NEW.preparation_claimed_at IS NOT NULL OR NEW.preparation_ready_at IS NOT NULL) THEN RAISE EXCEPTION 'Orphan preparation time' USING ERRCODE='23514'; END IF;
 IF NEW.delivery_assignee_id IS NULL AND (NEW.delivery_claimed_at IS NOT NULL OR NEW.collected_at IS NOT NULL OR NEW.arrived_at IS NOT NULL OR NEW.returned_at IS NOT NULL) THEN RAISE EXCEPTION 'Orphan delivery time' USING ERRCODE='23514'; END IF;
 IF NEW.state='unpaid_handover' AND (NEW.unpaid_handover_at IS NULL OR NEW.returned_at IS NOT NULL OR NEW.unpaid_handover_at<NEW.arrived_at) THEN RAISE EXCEPTION 'Invalid unpaid handover' USING ERRCODE='23514'; END IF;
 IF NEW.state<>'unpaid_handover' AND NEW.unpaid_handover_at IS NOT NULL THEN RAISE EXCEPTION 'No false handover' USING ERRCODE='23514'; END IF;
 IF NEW.incident IN ('absent','refused') AND (NEW.contact_attempt IS NULL OR length(btrim(NEW.contact_attempt))=0) THEN RAISE EXCEPTION 'Contact attempt required' USING ERRCODE='23514'; END IF;
 IF NEW.state='canceled' AND NEW.collected_at IS NOT NULL AND NEW.returned_at IS NULL THEN RAISE EXCEPTION 'Return collected drinks before cancellation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_preparation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prep_action text;
BEGIN
 IF NEW.evidence_mode<>'court_test' OR NEW.operation_version=OLD.operation_version THEN RETURN NULL; END IF;
 prep_action:=CASE WHEN OLD.state='awaiting_preparation' AND NEW.state='preparing' THEN 'claim'
  WHEN OLD.state='preparing' AND NEW.state='ready' THEN 'ready' WHEN NEW.state='exception' THEN 'hold' ELSE NULL END;
 IF prep_action IS NOT NULL AND EXISTS (SELECT 1 FROM preparation_command c JOIN order_event e ON e.id=c.id AND e.order_id=c.order_id AND e.actor_id=c.actor_id
  WHERE c.order_id=NEW.id AND c.kind=prep_action AND e.kind='preparation_'||c.kind AND c.order_version=NEW.operation_version
  AND (NEW.preparation_assignee_id IS NULL OR NEW.preparation_assignee_id=c.actor_id)) THEN RETURN NULL; END IF;
 IF OLD.state='awaiting_preparation' AND NEW.state='canceled' AND NEW.preparation_assignee_id IS NULL AND EXISTS
  (SELECT 1 FROM order_event WHERE order_id=NEW.id AND actor_id IS NULL AND kind='canceled') THEN RETURN NULL; END IF;
 IF NOT EXISTS (SELECT 1 FROM operation_command c JOIN order_event e ON e.id=c.id AND e.order_id=c.order_id AND e.actor_id=c.actor_id
  WHERE c.order_id=NEW.id AND e.kind='operation_'||c.kind AND (c.after->>'version')::int=NEW.operation_version
   AND c.after->>'state'=NEW.state AND (c.before->>'version')::int=OLD.operation_version
   AND (c.kind NOT IN ('resume','reassign','cancel','correct','unpaid_handover') OR
    (length(btrim(c.reason)) BETWEEN 1 AND 200 AND length(btrim(c.physical_check)) BETWEEN 1 AND 200
     AND c.reason IS NOT NULL AND c.physical_check IS NOT NULL))) THEN
  RAISE EXCEPTION 'Court transition requires versioned atomic audit' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_court_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.version<>OLD.version+1 OR NEW.actor_id IS NULL OR
   ((NEW.paused IS DISTINCT FROM OLD.paused)::int + (NEW.delivery_paused IS DISTINCT FROM OLD.delivery_paused)::int)<>1 THEN
  RAISE EXCEPTION 'Change one service switch with a new version and actor' USING ERRCODE='23514'; END IF;
 IF NEW.paused=OLD.paused AND NEW.reason IS DISTINCT FROM OLD.reason THEN RAISE EXCEPTION 'Cannot rewrite preparation pause reason' USING ERRCODE='23514'; END IF;
 IF NEW.delivery_paused=OLD.delivery_paused AND NEW.delivery_reason IS DISTINCT FROM OLD.delivery_reason THEN RAISE EXCEPTION 'Cannot rewrite delivery pause reason' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_court_service_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.delivery_paused IS DISTINCT FROM OLD.delivery_paused THEN
  IF NOT EXISTS (SELECT 1 FROM operation_command WHERE service_version=NEW.version AND actor_id=NEW.actor_id
   AND kind=CASE WHEN NEW.delivery_paused THEN 'pause_delivery' ELSE 'resume_delivery' END AND reason IS NOT DISTINCT FROM NEW.delivery_reason)
   THEN RAISE EXCEPTION 'Delivery pause requires atomic audit' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS (SELECT 1 FROM preparation_command WHERE service_version=NEW.version AND actor_id=NEW.actor_id
   AND kind=CASE WHEN NEW.paused THEN 'pause' ELSE 'resume' END AND reason IS NOT DISTINCT FROM NEW.reason)
   THEN RAISE EXCEPTION 'Preparation pause requires atomic audit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
