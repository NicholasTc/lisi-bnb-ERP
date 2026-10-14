-- Serialize session creation and activity against employee disabling.
CREATE FUNCTION enforce_session_employee() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active boolean;
BEGIN
  SELECT enabled INTO active FROM "user" WHERE id = NEW.user_id FOR SHARE;
  IF active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Employee cannot hold a session' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    NEW.last_activity_at := NEW.created_at;
    NEW.expires_at := LEAST(NEW.expires_at, NEW.created_at + interval '8 hours');
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.token IS DISTINCT FROM OLD.token
       OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.expires_at > OLD.expires_at THEN
      RAISE EXCEPTION 'Session identity and lifetime cannot be extended' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER session_employee_guard BEFORE INSERT OR UPDATE ON session
  FOR EACH ROW EXECUTE FUNCTION enforce_session_employee();
--> statement-breakpoint
CREATE FUNCTION revoke_disabled_employee_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.enabled = false THEN
    DELETE FROM session WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER employee_disable_revokes_sessions AFTER UPDATE OF enabled ON "user"
  FOR EACH ROW EXECUTE FUNCTION revoke_disabled_employee_sessions();
