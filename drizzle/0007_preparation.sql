CREATE TABLE "court_service" (
	"id" integer PRIMARY KEY NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "court_service_singleton" CHECK ("court_service"."id" = 1 AND "court_service"."version" > 0),
	CONSTRAINT "court_service_reason" CHECK (("court_service"."paused" AND length(btrim("court_service"."reason")) BETWEEN 1 AND 200 AND "court_service"."reason" IS NOT NULL) OR (NOT "court_service"."paused" AND "court_service"."reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "preparation_command" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"order_id" text,
	"kind" text NOT NULL,
	"digest" text NOT NULL,
	"reason" text,
	"service_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preparation_command_kind" CHECK (("preparation_command"."kind" IN ('claim','ready','hold') AND "preparation_command"."order_id" IS NOT NULL AND "preparation_command"."service_version" IS NULL) OR ("preparation_command"."kind" IN ('pause','resume') AND "preparation_command"."order_id" IS NULL AND "preparation_command"."service_version" > 1 AND "preparation_command"."service_version" IS NOT NULL)),
	CONSTRAINT "preparation_command_reason" CHECK (("preparation_command"."kind" IN ('hold','pause') AND "preparation_command"."reason" IS NOT NULL AND length(btrim("preparation_command"."reason")) BETWEEN 1 AND 200) OR ("preparation_command"."kind" NOT IN ('hold','pause') AND "preparation_command"."reason" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "order_state_valid";--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "preparation_assignee_id" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "preparation_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "preparation_ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "court_service" ADD CONSTRAINT "court_service_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_command" ADD CONSTRAINT "preparation_command_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_command" ADD CONSTRAINT "preparation_command_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preparation_command_order_idx" ON "preparation_command" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_preparation_assignee_id_user_id_fk" FOREIGN KEY ("preparation_assignee_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preparation_queue_idx" ON "customer_order" USING btree ("evidence_mode","state","created_at","id");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "preparation_fields_valid" CHECK (("customer_order"."preparation_assignee_id" IS NULL AND "customer_order"."preparation_claimed_at" IS NULL AND "customer_order"."preparation_ready_at" IS NULL AND "customer_order"."state" NOT IN ('preparing','ready')) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."preparation_assignee_id" IS NOT NULL AND "customer_order"."preparation_claimed_at" IS NOT NULL AND "customer_order"."preparation_claimed_at" >= "customer_order"."created_at" AND (("customer_order"."state" IN ('preparing','exception') AND "customer_order"."preparation_ready_at" IS NULL) OR ("customer_order"."state" = 'ready' AND "customer_order"."preparation_ready_at" IS NOT NULL AND "customer_order"."preparation_ready_at" >= "customer_order"."preparation_claimed_at"))));--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "order_state_valid" CHECK (("customer_order"."evidence_mode" = 'demo' AND "customer_order"."state" IN ('awaiting_payment','queued_for_preparation','canceled','exception')) OR ("customer_order"."evidence_mode" = 'court_test' AND "customer_order"."state" IN ('awaiting_preparation','preparing','ready','canceled','exception')));--> statement-breakpoint
INSERT INTO court_service (id) VALUES (1);
--> statement-breakpoint
CREATE TRIGGER immutable_preparation_command BEFORE UPDATE ON preparation_command FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['state','reason','expires_at','access_expires_at','preparation_assignee_id','preparation_claimed_at','preparation_ready_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['state','reason','expires_at','access_expires_at','preparation_assignee_id','preparation_claimed_at','preparation_ready_at'])
     OR NEW.expires_at > OLD.expires_at OR NEW.access_expires_at > OLD.access_expires_at THEN
    RAISE EXCEPTION 'Order snapshot cannot be rewritten' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION protect_preparation_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.evidence_mode <> 'court_test' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.state <> OLD.state AND NOT (
    (OLD.state = 'awaiting_preparation' AND NEW.state IN ('preparing','canceled','exception')) OR
    (OLD.state = 'preparing' AND NEW.state IN ('ready','exception'))
  ) THEN RAISE EXCEPTION 'Invalid court preparation transition' USING ERRCODE = '23514'; END IF;
  IF OLD.state <> 'awaiting_preparation' AND (
    NEW.preparation_assignee_id IS DISTINCT FROM OLD.preparation_assignee_id OR
    NEW.preparation_claimed_at IS DISTINCT FROM OLD.preparation_claimed_at
  ) THEN RAISE EXCEPTION 'Preparation ownership cannot be replaced' USING ERRCODE = '23514'; END IF;
  IF NEW.state = OLD.state AND (NEW.preparation_assignee_id IS DISTINCT FROM OLD.preparation_assignee_id OR
    NEW.preparation_claimed_at IS DISTINCT FROM OLD.preparation_claimed_at OR
    NEW.preparation_ready_at IS DISTINCT FROM OLD.preparation_ready_at OR NEW.reason IS DISTINCT FROM OLD.reason
  ) THEN RAISE EXCEPTION 'Preparation history cannot be rewritten' USING ERRCODE = '23514'; END IF;
  IF NEW.state = 'preparing' AND OLD.state = 'awaiting_preparation' THEN
    PERFORM 1 FROM "user" u JOIN employee_role r ON r.user_id = u.id
      WHERE u.id = NEW.preparation_assignee_id AND u.enabled AND r.role IN ('owner','preparation');
    IF NOT FOUND THEN RAISE EXCEPTION 'Preparation requires an authorized employee' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_preparation_transition BEFORE INSERT OR UPDATE ON customer_order FOR EACH ROW EXECUTE FUNCTION protect_preparation_transition();
--> statement-breakpoint
CREATE FUNCTION check_preparation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE action text;
BEGIN
  IF NEW.evidence_mode <> 'court_test' OR NEW.state = OLD.state THEN RETURN NULL; END IF;
  action := CASE NEW.state WHEN 'preparing' THEN 'claim' WHEN 'ready' THEN 'ready' WHEN 'exception' THEN 'hold' ELSE NULL END;
  IF action IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM preparation_command c JOIN order_event e ON e.id = c.id AND e.order_id = c.order_id
      AND e.actor_id = c.actor_id AND e.kind = 'preparation_' || c.kind
    WHERE c.order_id = NEW.id AND c.kind = action
      AND (NEW.preparation_assignee_id IS NULL OR c.actor_id = NEW.preparation_assignee_id)
      AND (action <> 'hold' OR c.reason = NEW.reason)
  ) THEN RAISE EXCEPTION 'Preparation transition requires an atomic audit record' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_preparation_audit AFTER UPDATE ON customer_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_preparation_audit();
--> statement-breakpoint
CREATE FUNCTION protect_court_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.version <> OLD.version + 1 OR NEW.actor_id IS NULL OR NEW.paused = OLD.paused THEN
    RAISE EXCEPTION 'Service changes require a new version and employee' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_court_service BEFORE UPDATE ON court_service FOR EACH ROW EXECUTE FUNCTION protect_court_service();
--> statement-breakpoint
CREATE FUNCTION check_court_service_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM preparation_command WHERE service_version = NEW.version AND actor_id = NEW.actor_id
    AND kind = CASE WHEN NEW.paused THEN 'pause' ELSE 'resume' END AND reason IS NOT DISTINCT FROM NEW.reason) THEN
    RAISE EXCEPTION 'Service change requires an atomic audit record' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_court_service_audit AFTER UPDATE ON court_service DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_court_service_audit();
