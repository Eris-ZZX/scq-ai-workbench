ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_supervisor_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_supervisor_name" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_directory_user_id_key"
	ON "users" USING btree ("directory_user_id")
	WHERE "directory_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_directory_supervisor_user_id_idx"
	ON "users" USING btree ("directory_supervisor_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"username" text,
	"display_name" text,
	"email" text,
	"avatar" text,
	"last_login_at" timestamp (3) with time zone,
	"last_sync_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identity_user_fkey"
		FOREIGN KEY ("user_id") REFERENCES "users"("id")
		ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_provider_issuer_subject_key"
	ON "user_identities" USING btree ("provider", "issuer", "subject");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_user_provider_issuer_key"
	ON "user_identities" USING btree ("user_id", "provider", "issuer");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx"
	ON "user_identities" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_todo_provider" text;
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_todo_id" text;
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_todo_assignee_id" text;
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_rework_todo_provider" text;
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_rework_todo_id" text;
--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests"
	ADD COLUMN IF NOT EXISTS "external_rework_todo_assignee_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_job_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp (3) with time zone,
	"locked_by" text,
	"last_error" text,
	"result" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_job_outbox_idempotency_key_key" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_job_outbox_status_available_idx"
	ON "external_job_outbox" USING btree ("status", "available_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_job_outbox_locked_at_idx"
	ON "external_job_outbox" USING btree ("locked_at");
--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value", "updated_at", "updated_by_id")
SELECT mapped.new_key, legacy."value", legacy."updated_at", legacy."updated_by_id"
FROM (
	VALUES
		('dingtalk.reviewSubmittedNotify.enabled', 'external.reviewSubmittedNotify.enabled'),
		('dingtalk.reviewRejectedNotify.enabled', 'external.reviewRejectedNotify.enabled'),
		('dingtalk.reviewApprovedNotify.enabled', 'external.reviewApprovedNotify.enabled'),
		('dingtalk.publishNotify.enabled', 'external.publishNotify.enabled')
) AS mapped(old_key, new_key)
JOIN "app_settings" legacy ON legacy."key" = mapped.old_key
WHERE NOT EXISTS (
	SELECT 1 FROM "app_settings" current_setting WHERE current_setting."key" = mapped.new_key
);
