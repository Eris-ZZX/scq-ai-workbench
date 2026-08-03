CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "component_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"policy" text DEFAULT 'whitelist' NOT NULL,
	"description" text,
	"depends_on_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_configs_name_unique" UNIQUE("name"),
	CONSTRAINT "component_configs_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "observability_events" (
	"id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text,
	"parent_span_id" text,
	"event_type" text NOT NULL,
	"path" text,
	"method" text,
	"user_id" text,
	"project_id" text,
	"status_code" integer,
	"duration_ms" integer,
	"request_body" text,
	"response_summary" text,
	"error_message" text,
	"error_stack" text,
	"timestamp" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role_name" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "position_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"email" text,
	"avatar" text,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"external_source" text,
	"external_id" text,
	"dingtalk_user_id" text,
	"sync_at" timestamp (3) with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"position_role_id" text NOT NULL,
	"effective_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_positions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "activity_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"stage" text NOT NULL,
	"project_task_name" text NOT NULL,
	"third_level_plan" text NOT NULL,
	"owner_role" text NOT NULL,
	"deliverable_name" text,
	"requires_deliverable" boolean DEFAULT false NOT NULL,
	"source_batch_id" text DEFAULT 'quality-activity-template-20260611' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_template_children" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_role_name" text NOT NULL,
	"responsible_role_id" text,
	"deliverable_name" text,
	"requires_deliverable" boolean DEFAULT false NOT NULL,
	"requires_attachment" boolean DEFAULT false NOT NULL,
	"requires_note" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_template_parents" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"closure_standard" text,
	"planned_start_offset_days" integer,
	"planned_offset_days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_template_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_built_in" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"latest_published_version_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_template_sets_code_unique" UNIQUE("code"),
	CONSTRAINT "activity_template_sets_latest_published_version_id_unique" UNIQUE("latest_published_version_id")
);
--> statement-breakpoint
CREATE TABLE "activity_template_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"name" text NOT NULL,
	"planned_start_offset_days" integer,
	"planned_due_offset_days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_set_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_version_id" text,
	"published_at" timestamp (3) with time zone,
	"published_by_id" text,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"external_source" text,
	"external_id" text,
	"sync_at" timestamp (3) with time zone,
	"start_date" timestamp (3) with time zone,
	"expected_end_date" timestamp (3) with time zone,
	"current_stage" text DEFAULT 'TR1' NOT NULL,
	"current_stage_started_at" timestamp (3) with time zone,
	"stage_gate_status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity_snapshot_metas" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"template_set_id" text NOT NULL,
	"template_version_id" text NOT NULL,
	"generated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"generated_by_id" text,
	"local_adjustment_count" integer DEFAULT 0 NOT NULL,
	"not_applicable_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_activity_snapshot_metas_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"assigned_role" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_position_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"position_role_id" text NOT NULL,
	"user_id" text NOT NULL,
	"appointed_by_id" text,
	"note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"blocked_reason" text,
	"completed_at" timestamp (3) with time zone,
	"start_date" timestamp (3) with time zone,
	"end_date" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_trial_plan_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"item" text NOT NULL,
	"planned_start_date" timestamp (3) with time zone,
	"planned_due_date" timestamp (3) with time zone,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_gate_records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"planned_start_date" timestamp (3) with time zone,
	"planned_due_date" timestamp (3) with time zone,
	"passed_at" timestamp (3) with time zone,
	"passed_by_id" text,
	"condition_release_note" text,
	"blocker_summary" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"child_id" text NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by_id" text NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"deleted_by_id" text,
	"delete_reason" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"child_id" text,
	"actor_user_id" text,
	"actor_role" text,
	"action_type" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text NOT NULL,
	"project_id" text,
	"child_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_by_id" text,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity_children" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text NOT NULL,
	"template_child_id" text,
	"third_level_plan" text NOT NULL,
	"owner_role" text NOT NULL,
	"responsible_role_id" text,
	"assignee_user_id" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"requires_deliverable" boolean DEFAULT false NOT NULL,
	"requires_attachment" boolean DEFAULT false NOT NULL,
	"requires_note" boolean DEFAULT false NOT NULL,
	"deliverable_name" text,
	"deliverable_url" text,
	"completion_note" text,
	"blocker_note" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_not_applicable" boolean DEFAULT false NOT NULL,
	"not_applicable_reason" text,
	"returned_at" timestamp (3) with time zone,
	"returned_by_id" text,
	"return_reason" text,
	"is_manually_added" boolean DEFAULT false NOT NULL,
	"planned_due_date_override" timestamp (3) with time zone,
	"completed_at" timestamp (3) with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity_parents" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"template_parent_id" text,
	"stage" text NOT NULL,
	"project_task_name" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"planned_start_date" timestamp (3) with time zone,
	"planned_due_date" timestamp (3) with time zone,
	"closed_at" timestamp (3) with time zone,
	"closed_by_id" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"has_blocked" boolean DEFAULT false NOT NULL,
	"has_overdue" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"project_id" text NOT NULL,
	"stage_id" text,
	"assignee_member_id" text,
	"creator_id" text NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"external_source" text,
	"external_id" text,
	"sync_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "task_status_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"owner_name" text NOT NULL,
	"visibility_scope" text DEFAULT 'ALL' NOT NULL,
	"visible_dept_ids" text DEFAULT '' NOT NULL,
	"visible_user_ids" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"archived_from_status" text,
	"resource_url" text,
	"content" text NOT NULL,
	"attachments" text,
	"extension" text,
	"extracted_text" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL,
	CONSTRAINT "ai_resources_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "ai_resource_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resource_favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"tag_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_resource_favorites_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "ai_resource_favorite_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resource_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resource_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"updated_by_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_resource_memberships_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_resource_migration_items" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"legacy_id" text NOT NULL,
	"target_id" text NOT NULL,
	"action" text NOT NULL,
	"before_data" text,
	"after_hash" text
);
--> statement-breakpoint
CREATE TABLE "ai_resource_migration_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"report_path" text,
	"operator_id" text,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp (3) with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "ai_resource_module_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resource_review_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resource_id" text,
	"proposed_data" text NOT NULL,
	"update_summary" text NOT NULL,
	"changed_fields" text DEFAULT '' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp (3) with time zone,
	"dingtalk_todo_id" text,
	"dingtalk_todo_union_id" text,
	"dingtalk_rework_todo_id" text,
	"dingtalk_rework_todo_union_id" text,
	"requester_id" text NOT NULL,
	"reviewer_id" text,
	CONSTRAINT "ai_resource_review_requests_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "ai_resource_role_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text,
	"subject_user_id" text,
	"subject_user_id_snapshot" text NOT NULL,
	"subject_username_snapshot" text NOT NULL,
	"actor_id" text,
	"from_role" text,
	"to_role" text,
	"action" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_resource_update_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"resource_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"reviewer_id" text,
	"review_id" text,
	"action" text NOT NULL,
	"result" text NOT NULL,
	"update_summary" text NOT NULL,
	"changed_fields" text DEFAULT '' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_resource_update_logs_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
ALTER TABLE "component_configs" ADD CONSTRAINT "component_config_depends_on_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "public"."component_configs"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "observability_events" ADD CONSTRAINT "observability_event_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "observability_events" ADD CONSTRAINT "observability_event_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_positions" ADD CONSTRAINT "user_position_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_positions" ADD CONSTRAINT "user_position_position_role_fkey" FOREIGN KEY ("position_role_id") REFERENCES "public"."position_roles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_children" ADD CONSTRAINT "activity_template_child_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."activity_template_parents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_children" ADD CONSTRAINT "activity_template_child_responsible_role_fkey" FOREIGN KEY ("responsible_role_id") REFERENCES "public"."position_roles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_parents" ADD CONSTRAINT "activity_template_parent_stage_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."activity_template_stages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_sets" ADD CONSTRAINT "activity_template_set_latest_published_version_fkey" FOREIGN KEY ("latest_published_version_id") REFERENCES "public"."activity_template_versions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_stages" ADD CONSTRAINT "activity_template_stage_version_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."activity_template_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_template_versions" ADD CONSTRAINT "activity_template_version_template_set_fkey" FOREIGN KEY ("template_set_id") REFERENCES "public"."activity_template_sets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_snapshot_metas" ADD CONSTRAINT "project_activity_snapshot_meta_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_snapshot_metas" ADD CONSTRAINT "project_activity_snapshot_meta_template_set_fkey" FOREIGN KEY ("template_set_id") REFERENCES "public"."activity_template_sets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_snapshot_metas" ADD CONSTRAINT "project_activity_snapshot_meta_template_version_fkey" FOREIGN KEY ("template_version_id") REFERENCES "public"."activity_template_versions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_member_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_member_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_position_assignments" ADD CONSTRAINT "project_position_assignment_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_position_assignments" ADD CONSTRAINT "project_position_assignment_position_role_fkey" FOREIGN KEY ("position_role_id") REFERENCES "public"."position_roles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_position_assignments" ADD CONSTRAINT "project_position_assignment_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stage_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_trial_plan_nodes" ADD CONSTRAINT "project_trial_plan_node_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stage_gate_records" ADD CONSTRAINT "stage_gate_record_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_attachments" ADD CONSTRAINT "activity_attachment_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_attachments" ADD CONSTRAINT "activity_attachment_child_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."project_activity_children"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_attachments" ADD CONSTRAINT "activity_attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_attachments" ADD CONSTRAINT "activity_attachment_deleted_by_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_event_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_event_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."project_activity_parents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_event_child_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."project_activity_children"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_event_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notification_recipient_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notification_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notification_child_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."project_activity_children"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notification_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."project_activity_parents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_template_child_fkey" FOREIGN KEY ("template_child_id") REFERENCES "public"."activity_template_children"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_responsible_role_fkey" FOREIGN KEY ("responsible_role_id") REFERENCES "public"."position_roles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_assignee_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_children" ADD CONSTRAINT "project_activity_child_returned_by_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_parents" ADD CONSTRAINT "project_activity_parent_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_parents" ADD CONSTRAINT "project_activity_parent_template_parent_fkey" FOREIGN KEY ("template_parent_id") REFERENCES "public"."activity_template_parents"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_activity_parents" ADD CONSTRAINT "project_activity_parent_closed_by_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_project_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_stage_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_assignee_member_fkey" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."project_members"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_creator_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_status_changes" ADD CONSTRAINT "task_status_change_task_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resources" ADD CONSTRAINT "ai_resource_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_comments" ADD CONSTRAINT "ai_resource_comment_resource_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."ai_resources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_comments" ADD CONSTRAINT "ai_resource_comment_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_favorites" ADD CONSTRAINT "ai_resource_favorite_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_favorites" ADD CONSTRAINT "ai_resource_favorite_resource_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."ai_resources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_favorites" ADD CONSTRAINT "ai_resource_favorite_tag_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."ai_resource_favorite_tags"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_favorite_tags" ADD CONSTRAINT "ai_resource_favorite_tag_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_likes" ADD CONSTRAINT "ai_resource_like_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_likes" ADD CONSTRAINT "ai_resource_like_resource_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."ai_resources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_memberships" ADD CONSTRAINT "ai_resource_membership_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_memberships" ADD CONSTRAINT "ai_resource_membership_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_migration_items" ADD CONSTRAINT "ai_resource_migration_item_run_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ai_resource_migration_runs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_migration_runs" ADD CONSTRAINT "ai_resource_migration_run_operator_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests" ADD CONSTRAINT "ai_resource_review_request_requester_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests" ADD CONSTRAINT "ai_resource_review_request_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_review_requests" ADD CONSTRAINT "ai_resource_review_request_resource_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."ai_resources"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_role_audits" ADD CONSTRAINT "ai_resource_role_audit_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."ai_resource_memberships"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_role_audits" ADD CONSTRAINT "ai_resource_role_audit_subject_user_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_role_audits" ADD CONSTRAINT "ai_resource_role_audit_actor_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_update_logs" ADD CONSTRAINT "ai_resource_update_log_resource_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."ai_resources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_update_logs" ADD CONSTRAINT "ai_resource_update_log_actor_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_resource_update_logs" ADD CONSTRAINT "ai_resource_update_log_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "component_configs_enabled_idx" ON "component_configs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "component_configs_order_idx" ON "component_configs" USING btree ("order");--> statement-breakpoint
CREATE INDEX "component_configs_depends_on_id_idx" ON "component_configs" USING btree ("depends_on_id");--> statement-breakpoint
CREATE INDEX "observability_events_trace_id_timestamp_idx" ON "observability_events" USING btree ("trace_id","timestamp");--> statement-breakpoint
CREATE INDEX "observability_events_event_type_idx" ON "observability_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "observability_events_timestamp_idx" ON "observability_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "observability_events_user_id_idx" ON "observability_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "position_roles_name_role_name_idx" ON "position_roles" USING btree ("name","role_name");--> statement-breakpoint
CREATE INDEX "position_roles_is_active_sort_order_idx" ON "position_roles" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "project_roles_sort_order_idx" ON "project_roles" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "project_roles_is_active_idx" ON "project_roles" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "user_external_source_external_id_key" ON "users" USING btree ("external_source","external_id");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_dingtalk_user_id_idx" ON "users" USING btree ("dingtalk_user_id");--> statement-breakpoint
CREATE INDEX "user_positions_position_role_id_idx" ON "user_positions" USING btree ("position_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_template_stage_project_task_name_third_level_plan_owner_role_source_batch_id_key" ON "activity_templates" USING btree ("stage","project_task_name","third_level_plan","owner_role","source_batch_id");--> statement-breakpoint
CREATE INDEX "activity_templates_stage_sort_order_idx" ON "activity_templates" USING btree ("stage","sort_order");--> statement-breakpoint
CREATE INDEX "activity_templates_owner_role_idx" ON "activity_templates" USING btree ("owner_role");--> statement-breakpoint
CREATE INDEX "activity_templates_is_active_idx" ON "activity_templates" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_template_child_parent_id_title_owner_role_name_key" ON "activity_template_children" USING btree ("parent_id","title","owner_role_name");--> statement-breakpoint
CREATE INDEX "activity_template_children_parent_id_sort_order_idx" ON "activity_template_children" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "activity_template_children_responsible_role_id_idx" ON "activity_template_children" USING btree ("responsible_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_template_parent_stage_id_name_key" ON "activity_template_parents" USING btree ("stage_id","name");--> statement-breakpoint
CREATE INDEX "activity_template_parents_stage_id_sort_order_idx" ON "activity_template_parents" USING btree ("stage_id","sort_order");--> statement-breakpoint
CREATE INDEX "activity_template_sets_is_active_idx" ON "activity_template_sets" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_template_stage_version_id_name_key" ON "activity_template_stages" USING btree ("version_id","name");--> statement-breakpoint
CREATE INDEX "activity_template_stages_version_id_sort_order_idx" ON "activity_template_stages" USING btree ("version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_template_version_template_set_id_version_key" ON "activity_template_versions" USING btree ("template_set_id","version");--> statement-breakpoint
CREATE INDEX "activity_template_versions_template_set_id_status_idx" ON "activity_template_versions" USING btree ("template_set_id","status");--> statement-breakpoint
CREATE INDEX "activity_template_versions_status_idx" ON "activity_template_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_current_stage_idx" ON "projects" USING btree ("current_stage");--> statement-breakpoint
CREATE INDEX "project_activity_snapshot_metas_template_set_id_idx" ON "project_activity_snapshot_metas" USING btree ("template_set_id");--> statement-breakpoint
CREATE INDEX "project_activity_snapshot_metas_template_version_id_idx" ON "project_activity_snapshot_metas" USING btree ("template_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_project_id_user_id_key" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_position_assignment_project_id_position_role_id_key" ON "project_position_assignments" USING btree ("project_id","position_role_id");--> statement-breakpoint
CREATE INDEX "project_position_assignments_project_id_idx" ON "project_position_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_position_assignments_user_id_idx" ON "project_position_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_position_assignments_position_role_id_idx" ON "project_position_assignments" USING btree ("position_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_stage_project_id_order_key" ON "project_stages" USING btree ("project_id","order");--> statement-breakpoint
CREATE INDEX "project_stages_project_id_order_idx" ON "project_stages" USING btree ("project_id","order");--> statement-breakpoint
CREATE INDEX "project_stages_project_id_status_idx" ON "project_stages" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_trial_plan_nodes_project_id_sort_order_idx" ON "project_trial_plan_nodes" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_gate_record_project_id_stage_key" ON "stage_gate_records" USING btree ("project_id","stage");--> statement-breakpoint
CREATE INDEX "stage_gate_records_project_id_status_idx" ON "stage_gate_records" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "stage_gate_records_stage_idx" ON "stage_gate_records" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "stage_templates_order_idx" ON "stage_templates" USING btree ("order");--> statement-breakpoint
CREATE INDEX "activity_attachments_project_id_created_at_idx" ON "activity_attachments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_attachments_child_id_idx" ON "activity_attachments" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "activity_attachments_uploaded_by_id_idx" ON "activity_attachments" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "activity_attachments_deleted_at_idx" ON "activity_attachments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "activity_events_project_id_created_at_idx" ON "activity_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_parent_id_created_at_idx" ON "activity_events" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_child_id_created_at_idx" ON "activity_events" USING btree ("child_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_actor_user_id_idx" ON "activity_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "activity_events_action_type_idx" ON "activity_events" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "notifications_recipient_user_id_status_created_at_idx" ON "notifications" USING btree ("recipient_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_project_id_idx" ON "notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notifications_child_id_idx" ON "notifications" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activity_child_parent_id_third_level_plan_owner_role_key" ON "project_activity_children" USING btree ("parent_id","third_level_plan","owner_role");--> statement-breakpoint
CREATE INDEX "project_activity_children_project_id_owner_role_idx" ON "project_activity_children" USING btree ("project_id","owner_role");--> statement-breakpoint
CREATE INDEX "project_activity_children_project_id_idx" ON "project_activity_children" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_activity_children_project_id_status_idx" ON "project_activity_children" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_activity_children_project_id_assignee_user_id_idx" ON "project_activity_children" USING btree ("project_id","assignee_user_id");--> statement-breakpoint
CREATE INDEX "project_activity_children_responsible_role_id_idx" ON "project_activity_children" USING btree ("responsible_role_id");--> statement-breakpoint
CREATE INDEX "project_activity_children_template_child_id_idx" ON "project_activity_children" USING btree ("template_child_id");--> statement-breakpoint
CREATE INDEX "project_activity_children_parent_id_sort_order_idx" ON "project_activity_children" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "project_activity_children_is_blocked_idx" ON "project_activity_children" USING btree ("is_blocked");--> statement-breakpoint
CREATE INDEX "project_activity_children_is_not_applicable_idx" ON "project_activity_children" USING btree ("is_not_applicable");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activity_parent_project_id_stage_project_task_name_key" ON "project_activity_parents" USING btree ("project_id","stage","project_task_name");--> statement-breakpoint
CREATE INDEX "project_activity_parents_project_id_stage_idx" ON "project_activity_parents" USING btree ("project_id","stage");--> statement-breakpoint
CREATE INDEX "project_activity_parents_project_id_status_idx" ON "project_activity_parents" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_activity_parents_template_parent_id_idx" ON "project_activity_parents" USING btree ("template_parent_id");--> statement-breakpoint
CREATE INDEX "project_activity_parents_has_blocked_idx" ON "project_activity_parents" USING btree ("has_blocked");--> statement-breakpoint
CREATE INDEX "project_activity_parents_has_overdue_idx" ON "project_activity_parents" USING btree ("has_overdue");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_assignee_member_id_status_idx" ON "tasks" USING btree ("assignee_member_id","status");--> statement-breakpoint
CREATE INDEX "tasks_creator_id_idx" ON "tasks" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "task_status_changes_task_id_created_at_idx" ON "task_status_changes" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_status_changes_changed_by_idx" ON "task_status_changes" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "ai_resources_type_idx" ON "ai_resources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_resources_status_idx" ON "ai_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_resources_created_by_id_idx" ON "ai_resources" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "ai_resources_updated_at_idx" ON "ai_resources" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ai_resources_created_at_idx" ON "ai_resources" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_resources_name_trgm_idx" ON "ai_resources" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resources_summary_trgm_idx" ON "ai_resources" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resources_tags_trgm_idx" ON "ai_resources" USING gin ("tags" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resources_owner_name_trgm_idx" ON "ai_resources" USING gin ("owner_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resources_content_trgm_idx" ON "ai_resources" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resources_extracted_text_trgm_idx" ON "ai_resources" USING gin ("extracted_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ai_resource_comments_resource_id_created_at_idx" ON "ai_resource_comments" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_resource_comments_user_id_idx" ON "ai_resource_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_resource_favorite_user_id_resource_id_key" ON "ai_resource_favorites" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_favorites_user_id_idx" ON "ai_resource_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_resource_favorites_user_id_sort_order_idx" ON "ai_resource_favorites" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "ai_resource_favorites_resource_id_idx" ON "ai_resource_favorites" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_favorites_tag_id_idx" ON "ai_resource_favorites" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_resource_favorite_tag_user_id_name_key" ON "ai_resource_favorite_tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "ai_resource_favorite_tags_user_id_sort_order_idx" ON "ai_resource_favorite_tags" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_resource_like_user_id_resource_id_key" ON "ai_resource_likes" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_likes_user_id_idx" ON "ai_resource_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_resource_likes_resource_id_idx" ON "ai_resource_likes" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_memberships_role_idx" ON "ai_resource_memberships" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_resource_migration_item_run_id_entity_type_legacy_id_key" ON "ai_resource_migration_items" USING btree ("run_id","entity_type","legacy_id");--> statement-breakpoint
CREATE INDEX "ai_resource_migration_items_run_id_idx" ON "ai_resource_migration_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_resource_migration_items_target_id_idx" ON "ai_resource_migration_items" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "ai_resource_migration_runs_status_idx" ON "ai_resource_migration_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_resource_migration_runs_started_at_idx" ON "ai_resource_migration_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ai_resource_review_requests_status_idx" ON "ai_resource_review_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_resource_review_requests_requester_id_idx" ON "ai_resource_review_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "ai_resource_review_requests_reviewer_id_idx" ON "ai_resource_review_requests" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "ai_resource_review_requests_resource_id_idx" ON "ai_resource_review_requests" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_role_audits_subject_user_id_idx" ON "ai_resource_role_audits" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "ai_resource_role_audits_created_at_idx" ON "ai_resource_role_audits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_resource_update_logs_resource_id_idx" ON "ai_resource_update_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "ai_resource_update_logs_created_at_idx" ON "ai_resource_update_logs" USING btree ("created_at");
