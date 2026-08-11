ALTER TABLE "feedback_logs"
	ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'suggestion' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_logs_category_idx"
	ON "feedback_logs" USING btree ("category");
