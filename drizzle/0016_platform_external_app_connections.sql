CREATE TABLE IF NOT EXISTS "platform_external_app_connections" (
	"app_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"launch_url" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"exchange_secret_ciphertext" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_external_app_connections_enabled_idx"
	ON "platform_external_app_connections" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_external_app_connections_updated_by_idx"
	ON "platform_external_app_connections" USING btree ("updated_by_user_id");
