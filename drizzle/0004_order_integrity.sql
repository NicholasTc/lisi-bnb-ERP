-- These guards complement application transactions; they do not replace permissions.
CREATE FUNCTION protect_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['state','reason','expires_at','access_expires_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['state','reason','expires_at','access_expires_at'])
     OR NEW.expires_at > OLD.expires_at OR NEW.access_expires_at > OLD.access_expires_at THEN
    RAISE EXCEPTION 'Order snapshot cannot be rewritten' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_order_snapshot BEFORE UPDATE ON customer_order FOR EACH ROW EXECUTE FUNCTION protect_order_snapshot();
--> statement-breakpoint
CREATE FUNCTION immutable_order_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical record cannot be updated' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER immutable_order_item BEFORE UPDATE ON order_item FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
CREATE TRIGGER immutable_payment BEFORE UPDATE ON payment_transaction FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
CREATE TRIGGER immutable_financial_event BEFORE UPDATE ON financial_event FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
CREATE TRIGGER immutable_demo_evidence BEFORE UPDATE ON demo_inbox FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
CREATE TRIGGER immutable_order_event BEFORE UPDATE ON order_event FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
--> statement-breakpoint
CREATE FUNCTION check_order_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; expected bigint; actual bigint; item_count integer;
BEGIN
  IF TG_TABLE_NAME = 'customer_order' THEN target := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN target := OLD.order_id;
  ELSE target := NEW.order_id; END IF;
  SELECT total_idr INTO expected FROM customer_order WHERE id = target;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(sum(quantity::bigint * unit_price_idr::bigint), 0), count(*) INTO actual, item_count FROM order_item WHERE order_id = target;
  IF actual <> expected OR item_count NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Order total must match immutable item snapshots' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER order_total_header AFTER INSERT OR UPDATE ON customer_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_order_total();
CREATE CONSTRAINT TRIGGER order_total_items AFTER INSERT OR UPDATE OR DELETE ON order_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_order_total();
--> statement-breakpoint
CREATE FUNCTION check_primary_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale customer_order;
BEGIN
  SELECT * INTO STRICT sale FROM customer_order WHERE id = NEW.order_id;
  IF NEW.matched AND NEW.amount_idr <> sale.total_idr THEN
    RAISE EXCEPTION 'Matched amount differs' USING ERRCODE = '23514';
  END IF;
  IF NEW.is_primary AND (sale.state <> 'awaiting_payment' OR sale.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Closed order cannot receive preparation eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_primary_payment BEFORE INSERT ON payment_transaction FOR EACH ROW EXECUTE FUNCTION check_primary_payment();
--> statement-breakpoint
CREATE FUNCTION check_preparation_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'queued_for_preparation' AND NOT EXISTS (
    SELECT 1 FROM payment_transaction p WHERE p.order_id = NEW.id AND p.is_primary AND p.matched
      AND NOT EXISTS (SELECT 1 FROM refund r WHERE r.payment_id = p.id AND r.state IN ('pending','succeeded'))
  ) THEN RAISE EXCEPTION 'Preparation requires an accepted payment' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.state = 'queued_for_preparation' AND OLD.state NOT IN ('awaiting_payment','queued_for_preparation') THEN
    RAISE EXCEPTION 'Closed order cannot be released automatically' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_preparation_eligibility BEFORE INSERT OR UPDATE ON customer_order FOR EACH ROW EXECUTE FUNCTION check_preparation_eligibility();
--> statement-breakpoint
CREATE FUNCTION protect_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE paid payment_transaction;
BEGIN
  IF TG_OP = 'UPDATE' AND ((to_jsonb(NEW) - 'state') IS DISTINCT FROM (to_jsonb(OLD) - 'state') OR
     (OLD.state <> 'pending' AND NEW.state <> OLD.state)) THEN
    RAISE EXCEPTION 'Refund history cannot be rewritten' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT paid FROM payment_transaction WHERE id = NEW.payment_id;
  IF NEW.order_id <> paid.order_id OR NEW.amount_idr <> paid.amount_idr THEN
    RAISE EXCEPTION 'Refund must match its full payment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_refund BEFORE INSERT OR UPDATE ON refund FOR EACH ROW EXECUTE FUNCTION protect_refund();
--> statement-breakpoint
CREATE FUNCTION check_refund_fulfillment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM refund r JOIN payment_transaction p ON p.id = r.payment_id
    JOIN customer_order o ON o.id = p.order_id WHERE r.id = NEW.id AND r.state IN ('pending','succeeded')
    AND p.is_primary AND o.state = 'queued_for_preparation') THEN
    RAISE EXCEPTION 'Primary refund must cancel preparation eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_refund_fulfillment AFTER INSERT OR UPDATE ON refund DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_refund_fulfillment();
