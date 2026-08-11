CREATE TABLE IF NOT EXISTS "notification_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_idempotency_key_key" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_status_available_idx"
	ON "notification_outbox" USING btree ("status", "available_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_locked_at_idx"
	ON "notification_outbox" USING btree ("locked_at");
