ALTER TABLE "users" ADD COLUMN "platform_role" text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
UPDATE "users"
SET "platform_role" = CASE WHEN "role" = 'admin' THEN 'admin' ELSE 'user' END;
--> statement-breakpoint
CREATE INDEX "users_platform_role_idx" ON "users" USING btree ("platform_role");
