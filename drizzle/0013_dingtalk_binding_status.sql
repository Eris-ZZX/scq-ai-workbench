ALTER TABLE "users"
	ADD COLUMN "dingtalk_binding_status" text NOT NULL DEFAULT 'unbound';
--> statement-breakpoint
UPDATE "users"
SET "dingtalk_binding_status" = CASE
	WHEN "dingtalk_user_id" IS NOT NULL AND "unionid" IS NOT NULL THEN 'bound'
	ELSE 'unbound'
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_dingtalk_binding_status_idx"
	ON "users" USING btree ("dingtalk_binding_status");
