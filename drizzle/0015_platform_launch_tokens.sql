CREATE TABLE IF NOT EXISTS "platform_launch_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"subject_user_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"consumed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_launch_tokens_token_hash_key"
	ON "platform_launch_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_launch_tokens_app_expires_idx"
	ON "platform_launch_tokens" USING btree ("app_id", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_launch_tokens_subject_user_id_idx"
	ON "platform_launch_tokens" USING btree ("subject_user_id");
