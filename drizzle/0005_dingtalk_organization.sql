CREATE TABLE "dingtalk_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"sync_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dingtalk_departments_parent_id_idx" ON "dingtalk_departments" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX "dingtalk_departments_sync_at_idx" ON "dingtalk_departments" USING btree ("sync_at");
--> statement-breakpoint
CREATE TABLE "user_dingtalk_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"department_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sync_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_dingtalk_departments" ADD CONSTRAINT "user_dingtalk_department_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "user_dingtalk_departments" ADD CONSTRAINT "user_dingtalk_department_department_fkey" FOREIGN KEY ("department_id") REFERENCES "dingtalk_departments"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_dingtalk_departments_user_department_key" ON "user_dingtalk_departments" USING btree ("user_id","department_id");
--> statement-breakpoint
CREATE INDEX "user_dingtalk_departments_user_id_idx" ON "user_dingtalk_departments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "user_dingtalk_departments_department_id_idx" ON "user_dingtalk_departments" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX "user_dingtalk_departments_primary_idx" ON "user_dingtalk_departments" USING btree ("user_id","is_primary");
