CREATE TABLE IF NOT EXISTS "feedback_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"application" text,
	"page_path" text,
	"attachments" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_logs" ADD CONSTRAINT "feedback_log_user_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id")
	ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_logs_created_at_idx"
	ON "feedback_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_logs_user_id_idx"
	ON "feedback_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_logs_application_idx"
	ON "feedback_logs" USING btree ("application");
