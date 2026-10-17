CREATE TABLE "employee_command" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"target_id" text NOT NULL,
	"kind" text NOT NULL,
	"digest" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_command_kind" CHECK ("employee_command"."kind" IN ('create','edit','password_changed'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_command" ADD CONSTRAINT "employee_command_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_command" ADD CONSTRAINT "employee_command_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_command_target_idx" ON "employee_command" USING btree ("target_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT employee_version_positive CHECK (version > 0);
CREATE UNIQUE INDEX employee_email_normalized ON "user" (lower(btrim(email)));
CREATE TRIGGER immutable_employee_command BEFORE UPDATE ON employee_command FOR EACH ROW EXECUTE FUNCTION immutable_order_record();
