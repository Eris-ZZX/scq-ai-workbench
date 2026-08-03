ALTER TABLE "users" ADD COLUMN "supervisor_dingtalk_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "supervisor_name" text;
--> statement-breakpoint
CREATE INDEX "users_supervisor_dingtalk_user_id_idx" ON "users" USING btree ("supervisor_dingtalk_user_id");
