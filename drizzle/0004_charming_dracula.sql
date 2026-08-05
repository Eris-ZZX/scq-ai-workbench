CREATE TABLE "ai_resource_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_username_snapshot" text NOT NULL,
	"action" text NOT NULL,
	"module" text DEFAULT 'AI_RESOURCE' NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"resource_id" text,
	"review_id" text,
	"result" text NOT NULL,
	"reason" text,
	"before_data" text,
	"after_data" text,
	"trace_id" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_resource_audit_logs_actor_id_idx" ON "ai_resource_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "ai_resource_audit_logs_action_idx" ON "ai_resource_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ai_resource_audit_logs_target_idx" ON "ai_resource_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ai_resource_audit_logs_resource_id_idx" ON "ai_resource_audit_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_audit_logs_created_at_idx" ON "ai_resource_audit_logs" USING btree ("created_at");--> statement-breakpoint