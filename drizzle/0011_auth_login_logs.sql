CREATE TABLE IF NOT EXISTS "auth_login_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"stage" text NOT NULL,
	"outcome" text NOT NULL,
	"username" text,
	"display_name" text,
	"error_code" text,
	"error_message" text,
	"error_params" text DEFAULT '{}' NOT NULL,
	"request_path" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_login_logs" ADD CONSTRAINT "auth_login_log_user_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id")
	ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_logs_created_at_idx"
	ON "auth_login_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_logs_provider_outcome_idx"
	ON "auth_login_logs" USING btree ("provider", "outcome");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_logs_username_idx"
	ON "auth_login_logs" USING btree ("username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_logs_user_id_idx"
	ON "auth_login_logs" USING btree ("user_id");
