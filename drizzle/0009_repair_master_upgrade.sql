-- 修复从 master 升级到 dev 的库：master 时代无 DWS/Authing 对象，
-- 若迁移记录与真实 schema 不一致（0006/0007 被跳过），本迁移幂等补全。
-- 全部使用 IF NOT EXISTS / IF EXISTS，可安全重跑。

-- users 补充 dev 新增列（0006 + 0007 的列）
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_supervisor_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "directory_supervisor_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "unionid" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthdate" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_username" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "zoneinfo" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_id_authing" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extended_fields" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userpool_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" text;
--> statement-breakpoint

-- users 补充索引（若缺）
CREATE UNIQUE INDEX IF NOT EXISTS "users_directory_user_id_key"
	ON "users" USING btree ("directory_user_id")
	WHERE "directory_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_directory_supervisor_user_id_idx"
	ON "users" USING btree ("directory_supervisor_user_id");
--> statement-breakpoint

-- user_identities 表（Authing 登录必需）
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

-- ai_resource_review_requests 补充 external_todo 列（DWS 时代遗留，dev 保留）
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
