// Generated once from the retired data model, then normalized for the Drizzle-only runtime.
// @ts-nocheck -- circular PostgreSQL foreign keys are valid at runtime but defeat TS initializer inference.
import { randomUUID } from 'node:crypto'
import { relations } from 'drizzle-orm'
import { boolean, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const User = pgTable('users', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	username: text('username').notNull().unique(),
	displayName: text('display_name'),
	passwordHash: text('password_hash').notNull(),
	email: text('email').unique(),
	avatar: text('avatar'),
	platformRole: text('platform_role').notNull().default("user"),
	role: text('role').notNull().default("user"),
	status: text('status').notNull().default("active"),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
	externalSource: text('external_source'),
	externalId: text('external_id'),
	dingtalkUserId: text('dingtalk_user_id'),
	supervisorDingtalkUserId: text('supervisor_dingtalk_user_id'),
	supervisorName: text('supervisor_name'),
	directoryUserId: text('directory_user_id'),
	directorySupervisorUserId: text('directory_supervisor_user_id'),
	directorySupervisorName: text('directory_supervisor_name'),
	syncAt: timestamp('sync_at', { precision: 3, withTimezone: true }),
	// --- Authing OIDC claims (字段名与 claim 一致，便于对齐) ---
	unionid: text('unionid'),
	phoneNumber: text('phone_number'),
	phoneNumberVerified: boolean('phone_number_verified'),
	emailVerified: boolean('email_verified'),
	address: text('address'),
	birthdate: text('birthdate'),
	gender: text('gender'),
	locale: text('locale'),
	nickname: text('nickname'),
	preferredUsername: text('preferred_username'),
	profile: text('profile'),
	website: text('website'),
	zoneinfo: text('zoneinfo'),
	externalIdAuthing: text('external_id_authing'),
	extendedFields: text('extended_fields'),
	tenantId: text('tenant_id'),
	userpoolId: text('userpool_id'),
	roles: text('roles'),
}, (User) => ({
	'User_externalSource_externalId_unique_idx': uniqueIndex('user_external_source_external_id_key')
		.on(User.externalSource, User.externalId),
	'users_username_idx': index('users_username_idx').on(User.username),
	'users_role_idx': index('users_role_idx').on(User.role),
	'users_platform_role_idx': index('users_platform_role_idx').on(User.platformRole),
	'users_status_idx': index('users_status_idx').on(User.status),
	'users_dingtalk_user_id_idx': index('users_dingtalk_user_id_idx').on(User.dingtalkUserId),
	'users_supervisor_dingtalk_user_id_idx': index('users_supervisor_dingtalk_user_id_idx').on(User.supervisorDingtalkUserId),
	'users_directory_user_id_key': uniqueIndex('users_directory_user_id_key').on(User.directoryUserId),
	'users_directory_supervisor_user_id_idx': index('users_directory_supervisor_user_id_idx').on(User.directorySupervisorUserId),
}));

export const FeedbackLog = pgTable('feedback_logs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id'),
	content: text('content').notNull(),
	application: text('application'),
	pagePath: text('page_path'),
	attachments: text('attachments').notNull().default("[]"),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (FeedbackLog) => ({
	'FeedbackLog_user_fkey': foreignKey({
		name: 'feedback_log_user_fkey',
		columns: [FeedbackLog.userId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'feedback_logs_created_at_idx': index('feedback_logs_created_at_idx').on(FeedbackLog.createdAt),
	'feedback_logs_user_id_idx': index('feedback_logs_user_id_idx').on(FeedbackLog.userId),
	'feedback_logs_application_idx': index('feedback_logs_application_idx').on(FeedbackLog.application)
}));

export const AuthLoginLog = pgTable('auth_login_logs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id'),
	provider: text('provider').notNull(),
	stage: text('stage').notNull(),
	outcome: text('outcome').notNull(),
	username: text('username'),
	displayName: text('display_name'),
	errorCode: text('error_code'),
	errorMessage: text('error_message'),
	errorParams: text('error_params').notNull().default("{}"),
	requestPath: text('request_path'),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AuthLoginLog) => ({
	'AuthLoginLog_user_fkey': foreignKey({
		name: 'auth_login_log_user_fkey',
		columns: [AuthLoginLog.userId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'auth_login_logs_created_at_idx': index('auth_login_logs_created_at_idx').on(AuthLoginLog.createdAt),
	'auth_login_logs_provider_outcome_idx': index('auth_login_logs_provider_outcome_idx').on(AuthLoginLog.provider, AuthLoginLog.outcome),
	'auth_login_logs_username_idx': index('auth_login_logs_username_idx').on(AuthLoginLog.username),
	'auth_login_logs_user_id_idx': index('auth_login_logs_user_id_idx').on(AuthLoginLog.userId)
}));

export const UserIdentity = pgTable('user_identities', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull(),
	provider: text('provider').notNull(),
	issuer: text('issuer').notNull(),
	subject: text('subject').notNull(),
	username: text('username'),
	displayName: text('display_name'),
	email: text('email'),
	avatar: text('avatar'),
	lastLoginAt: timestamp('last_login_at', { precision: 3, withTimezone: true }),
	lastSyncAt: timestamp('last_sync_at', { precision: 3, withTimezone: true }),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (UserIdentity) => ({
	'UserIdentity_user_fkey': foreignKey({
		name: 'user_identity_user_fkey',
		columns: [UserIdentity.userId],
		foreignColumns: [User.id],
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'user_identities_provider_issuer_subject_key': uniqueIndex('user_identities_provider_issuer_subject_key')
		.on(UserIdentity.provider, UserIdentity.issuer, UserIdentity.subject),
	'user_identities_user_provider_issuer_key': uniqueIndex('user_identities_user_provider_issuer_key')
		.on(UserIdentity.userId, UserIdentity.provider, UserIdentity.issuer),
	'user_identities_user_id_idx': index('user_identities_user_id_idx').on(UserIdentity.userId),
}));

export const DingTalkDepartment = pgTable('dingtalk_departments', {
	id: text('id').notNull().primaryKey(),
	name: text('name').notNull(),
	parentId: text('parent_id'),
	syncAt: timestamp('sync_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
}, (DingTalkDepartment) => ({
	'dingtalk_departments_parent_id_idx': index('dingtalk_departments_parent_id_idx').on(DingTalkDepartment.parentId),
	'dingtalk_departments_sync_at_idx': index('dingtalk_departments_sync_at_idx').on(DingTalkDepartment.syncAt),
}));

export const UserDingTalkDepartment = pgTable('user_dingtalk_departments', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull(),
	departmentId: text('department_id').notNull(),
	isPrimary: boolean('is_primary').notNull().default(false),
	syncAt: timestamp('sync_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
}, (UserDingTalkDepartment) => ({
	'UserDingTalkDepartment_user_fkey': foreignKey({
		name: 'user_dingtalk_department_user_fkey',
		columns: [UserDingTalkDepartment.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'UserDingTalkDepartment_department_fkey': foreignKey({
		name: 'user_dingtalk_department_department_fkey',
		columns: [UserDingTalkDepartment.departmentId],
		foreignColumns: [DingTalkDepartment.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'UserDingTalkDepartment_user_department_unique_idx': uniqueIndex('user_dingtalk_departments_user_department_key')
		.on(UserDingTalkDepartment.userId, UserDingTalkDepartment.departmentId),
	'user_dingtalk_departments_user_id_idx': index('user_dingtalk_departments_user_id_idx').on(UserDingTalkDepartment.userId),
	'user_dingtalk_departments_department_id_idx': index('user_dingtalk_departments_department_id_idx').on(UserDingTalkDepartment.departmentId),
	'user_dingtalk_departments_primary_idx': index('user_dingtalk_departments_primary_idx').on(UserDingTalkDepartment.userId, UserDingTalkDepartment.isPrimary),
}));

export const Project = pgTable('projects', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	status: text('status').notNull().default("active"),
	completedAt: timestamp('completed_at', { precision: 3, withTimezone: true }),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
	externalSource: text('external_source'),
	externalId: text('external_id'),
	syncAt: timestamp('sync_at', { precision: 3, withTimezone: true }),
	startDate: timestamp('start_date', { precision: 3, withTimezone: true }),
	expectedEndDate: timestamp('expected_end_date', { precision: 3, withTimezone: true }),
	currentStage: text('current_stage').notNull().default("TR1"),
	currentStageStartedAt: timestamp('current_stage_started_at', { precision: 3, withTimezone: true }),
	stageGateStatus: text('stage_gate_status').notNull().default("active")
}, (Project) => ({
	'projects_status_idx': index('projects_status_idx').on(Project.status),
	'projects_current_stage_idx': index('projects_current_stage_idx').on(Project.currentStage),
}));

export const ProjectMember = pgTable('project_members', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	userId: text('user_id').notNull(),
	role: text('role').notNull().default("member"),
	assignedRole: text('assigned_role'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (ProjectMember) => ({
	'ProjectMember_project_fkey': foreignKey({
		name: 'project_member_project_fkey',
		columns: [ProjectMember.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectMember_user_fkey': foreignKey({
		name: 'project_member_user_fkey',
		columns: [ProjectMember.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectMember_projectId_userId_unique_idx': uniqueIndex('project_member_project_id_user_id_key')
		.on(ProjectMember.projectId, ProjectMember.userId),
	'project_members_project_id_idx': index('project_members_project_id_idx').on(ProjectMember.projectId),
	'project_members_user_id_idx': index('project_members_user_id_idx').on(ProjectMember.userId),
}));

export const ProjectRole = pgTable('project_roles', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectRole) => ({
	'project_roles_sort_order_idx': index('project_roles_sort_order_idx').on(ProjectRole.sortOrder),
	'project_roles_is_active_idx': index('project_roles_is_active_idx').on(ProjectRole.isActive),
}));

export const PositionRole = pgTable('position_roles', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	name: text('name').notNull().unique(),
	roleName: text('role_name'),
	description: text('description'),
	isActive: boolean('is_active').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (PositionRole) => ({
	'position_roles_name_role_name_idx': index('position_roles_name_role_name_idx').on(PositionRole.name, PositionRole.roleName),
	'position_roles_is_active_sort_order_idx': index('position_roles_is_active_sort_order_idx').on(PositionRole.isActive, PositionRole.sortOrder),
}));

export const UserPosition = pgTable('user_positions', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull().unique(),
	positionRoleId: text('position_role_id').notNull(),
	effectiveAt: timestamp('effective_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (UserPosition) => ({
	'UserPosition_user_fkey': foreignKey({
		name: 'user_position_user_fkey',
		columns: [UserPosition.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'UserPosition_positionRole_fkey': foreignKey({
		name: 'user_position_position_role_fkey',
		columns: [UserPosition.positionRoleId],
		foreignColumns: [PositionRole.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'user_positions_position_role_id_idx': index('user_positions_position_role_id_idx').on(UserPosition.positionRoleId),
}));

export const ProjectPositionAssignment = pgTable('project_position_assignments', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	positionRoleId: text('position_role_id').notNull(),
	userId: text('user_id').notNull(),
	appointedById: text('appointed_by_id'),
	note: text('note'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectPositionAssignment) => ({
	'ProjectPositionAssignment_project_fkey': foreignKey({
		name: 'project_position_assignment_project_fkey',
		columns: [ProjectPositionAssignment.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectPositionAssignment_positionRole_fkey': foreignKey({
		name: 'project_position_assignment_position_role_fkey',
		columns: [ProjectPositionAssignment.positionRoleId],
		foreignColumns: [PositionRole.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'ProjectPositionAssignment_user_fkey': foreignKey({
		name: 'project_position_assignment_user_fkey',
		columns: [ProjectPositionAssignment.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectPositionAssignment_projectId_positionRoleId_unique_idx': uniqueIndex('project_position_assignment_project_id_position_role_id_key')
		.on(ProjectPositionAssignment.projectId, ProjectPositionAssignment.positionRoleId),
	'project_position_assignments_project_id_idx': index('project_position_assignments_project_id_idx').on(ProjectPositionAssignment.projectId),
	'project_position_assignments_user_id_idx': index('project_position_assignments_user_id_idx').on(ProjectPositionAssignment.userId),
	'project_position_assignments_position_role_id_idx': index('project_position_assignments_position_role_id_idx').on(ProjectPositionAssignment.positionRoleId),
}));

export const StageTemplate = pgTable('stage_templates', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	order: integer('order').notNull().default(0),
	isDefault: boolean('is_default').notNull().default(false),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (StageTemplate) => ({
	'stage_templates_order_idx': index('stage_templates_order_idx').on(StageTemplate.order),
}));

export const ProjectStage = pgTable('project_stages', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	order: integer('order').notNull().default(0),
	status: text('status').notNull().default("pending"),
	blockedReason: text('blocked_reason'),
	completedAt: timestamp('completed_at', { precision: 3, withTimezone: true }),
	startDate: timestamp('start_date', { precision: 3, withTimezone: true }),
	endDate: timestamp('end_date', { precision: 3, withTimezone: true }),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectStage) => ({
	'ProjectStage_project_fkey': foreignKey({
		name: 'project_stage_project_fkey',
		columns: [ProjectStage.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectStage_projectId_order_unique_idx': uniqueIndex('project_stage_project_id_order_key')
		.on(ProjectStage.projectId, ProjectStage.order),
	'project_stages_project_id_order_idx': index('project_stages_project_id_order_idx').on(ProjectStage.projectId, ProjectStage.order),
	'project_stages_project_id_status_idx': index('project_stages_project_id_status_idx').on(ProjectStage.projectId, ProjectStage.status),
}));

export const ActivityTemplateSet = pgTable('activity_template_sets', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	description: text('description'),
	isBuiltIn: boolean('is_built_in').notNull().default(true),
	isActive: boolean('is_active').notNull().default(true),
	latestPublishedVersionId: text('latest_published_version_id').unique(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplateSet) => ({
	'ActivityTemplateSet_latestPublishedVersion_fkey': foreignKey({
		name: 'activity_template_set_latest_published_version_fkey',
		columns: [ActivityTemplateSet.latestPublishedVersionId],
		foreignColumns: [ActivityTemplateVersion.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'activity_template_sets_is_active_idx': index('activity_template_sets_is_active_idx').on(ActivityTemplateSet.isActive),
}));

export const ActivityTemplateVersion = pgTable('activity_template_versions', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	templateSetId: text('template_set_id').notNull(),
	version: integer('version').notNull(),
	status: text('status').notNull().default("draft"),
	sourceVersionId: text('source_version_id'),
	publishedAt: timestamp('published_at', { precision: 3, withTimezone: true }),
	publishedById: text('published_by_id'),
	notes: text('notes'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplateVersion) => ({
	'ActivityTemplateVersion_templateSet_fkey': foreignKey({
		name: 'activity_template_version_template_set_fkey',
		columns: [ActivityTemplateVersion.templateSetId],
		foreignColumns: [ActivityTemplateSet.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityTemplateVersion_templateSetId_version_unique_idx': uniqueIndex('activity_template_version_template_set_id_version_key')
		.on(ActivityTemplateVersion.templateSetId, ActivityTemplateVersion.version),
	'activity_template_versions_template_set_id_status_idx': index('activity_template_versions_template_set_id_status_idx').on(ActivityTemplateVersion.templateSetId, ActivityTemplateVersion.status),
	'activity_template_versions_status_idx': index('activity_template_versions_status_idx').on(ActivityTemplateVersion.status),
}));

export const ActivityTemplateStage = pgTable('activity_template_stages', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	versionId: text('version_id').notNull(),
	name: text('name').notNull(),
	plannedStartOffsetDays: integer('planned_start_offset_days'),
	plannedDueOffsetDays: integer('planned_due_offset_days'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplateStage) => ({
	'ActivityTemplateStage_version_fkey': foreignKey({
		name: 'activity_template_stage_version_fkey',
		columns: [ActivityTemplateStage.versionId],
		foreignColumns: [ActivityTemplateVersion.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityTemplateStage_versionId_name_unique_idx': uniqueIndex('activity_template_stage_version_id_name_key')
		.on(ActivityTemplateStage.versionId, ActivityTemplateStage.name),
	'activity_template_stages_version_id_sort_order_idx': index('activity_template_stages_version_id_sort_order_idx').on(ActivityTemplateStage.versionId, ActivityTemplateStage.sortOrder),
}));

export const ActivityTemplateParent = pgTable('activity_template_parents', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	stageId: text('stage_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	closureStandard: text('closure_standard'),
	plannedStartOffsetDays: integer('planned_start_offset_days'),
	plannedOffsetDays: integer('planned_offset_days'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplateParent) => ({
	'ActivityTemplateParent_stage_fkey': foreignKey({
		name: 'activity_template_parent_stage_fkey',
		columns: [ActivityTemplateParent.stageId],
		foreignColumns: [ActivityTemplateStage.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityTemplateParent_stageId_name_unique_idx': uniqueIndex('activity_template_parent_stage_id_name_key')
		.on(ActivityTemplateParent.stageId, ActivityTemplateParent.name),
	'activity_template_parents_stage_id_sort_order_idx': index('activity_template_parents_stage_id_sort_order_idx').on(ActivityTemplateParent.stageId, ActivityTemplateParent.sortOrder),
}));

export const ActivityTemplateChild = pgTable('activity_template_children', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	parentId: text('parent_id').notNull(),
	title: text('title').notNull(),
	ownerRoleName: text('owner_role_name').notNull(),
	responsibleRoleId: text('responsible_role_id'),
	deliverableName: text('deliverable_name'),
	requiresDeliverable: boolean('requires_deliverable').notNull().default(false),
	requiresAttachment: boolean('requires_attachment').notNull().default(false),
	requiresNote: boolean('requires_note').notNull().default(false),
	isRequired: boolean('is_required').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplateChild) => ({
	'ActivityTemplateChild_parent_fkey': foreignKey({
		name: 'activity_template_child_parent_fkey',
		columns: [ActivityTemplateChild.parentId],
		foreignColumns: [ActivityTemplateParent.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityTemplateChild_responsibleRole_fkey': foreignKey({
		name: 'activity_template_child_responsible_role_fkey',
		columns: [ActivityTemplateChild.responsibleRoleId],
		foreignColumns: [PositionRole.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ActivityTemplateChild_parentId_title_ownerRoleName_unique_idx': uniqueIndex('activity_template_child_parent_id_title_owner_role_name_key')
		.on(ActivityTemplateChild.parentId, ActivityTemplateChild.title, ActivityTemplateChild.ownerRoleName),
	'activity_template_children_parent_id_sort_order_idx': index('activity_template_children_parent_id_sort_order_idx').on(ActivityTemplateChild.parentId, ActivityTemplateChild.sortOrder),
	'activity_template_children_responsible_role_id_idx': index('activity_template_children_responsible_role_id_idx').on(ActivityTemplateChild.responsibleRoleId),
}));

export const ProjectActivitySnapshotMeta = pgTable('project_activity_snapshot_metas', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull().unique(),
	templateSetId: text('template_set_id').notNull(),
	templateVersionId: text('template_version_id').notNull(),
	generatedAt: timestamp('generated_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	generatedById: text('generated_by_id'),
	localAdjustmentCount: integer('local_adjustment_count').notNull().default(0),
	notApplicableCount: integer('not_applicable_count').notNull().default(0),
	notes: text('notes'),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectActivitySnapshotMeta) => ({
	'ProjectActivitySnapshotMeta_project_fkey': foreignKey({
		name: 'project_activity_snapshot_meta_project_fkey',
		columns: [ProjectActivitySnapshotMeta.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectActivitySnapshotMeta_templateSet_fkey': foreignKey({
		name: 'project_activity_snapshot_meta_template_set_fkey',
		columns: [ProjectActivitySnapshotMeta.templateSetId],
		foreignColumns: [ActivityTemplateSet.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'ProjectActivitySnapshotMeta_templateVersion_fkey': foreignKey({
		name: 'project_activity_snapshot_meta_template_version_fkey',
		columns: [ProjectActivitySnapshotMeta.templateVersionId],
		foreignColumns: [ActivityTemplateVersion.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'project_activity_snapshot_metas_template_set_id_idx': index('project_activity_snapshot_metas_template_set_id_idx').on(ProjectActivitySnapshotMeta.templateSetId),
	'project_activity_snapshot_metas_template_version_id_idx': index('project_activity_snapshot_metas_template_version_id_idx').on(ProjectActivitySnapshotMeta.templateVersionId),
}));

export const ActivityTemplate = pgTable('activity_templates', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	stage: text('stage').notNull(),
	projectTaskName: text('project_task_name').notNull(),
	thirdLevelPlan: text('third_level_plan').notNull(),
	ownerRole: text('owner_role').notNull(),
	deliverableName: text('deliverable_name'),
	requiresDeliverable: boolean('requires_deliverable').notNull().default(false),
	sourceBatchId: text('source_batch_id').notNull().default("quality-activity-template-20260611"),
	sortOrder: integer('sort_order').notNull().default(0),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ActivityTemplate) => ({
	'ActivityTemplate_stage_projectTaskName_thirdLevelPlan_ownerRole_sourceBatchId_unique_idx': uniqueIndex('activity_template_stage_project_task_name_third_level_plan_owner_role_source_batch_id_key')
		.on(ActivityTemplate.stage, ActivityTemplate.projectTaskName, ActivityTemplate.thirdLevelPlan, ActivityTemplate.ownerRole, ActivityTemplate.sourceBatchId),
	'activity_templates_stage_sort_order_idx': index('activity_templates_stage_sort_order_idx').on(ActivityTemplate.stage, ActivityTemplate.sortOrder),
	'activity_templates_owner_role_idx': index('activity_templates_owner_role_idx').on(ActivityTemplate.ownerRole),
	'activity_templates_is_active_idx': index('activity_templates_is_active_idx').on(ActivityTemplate.isActive),
}));

export const ProjectActivityParent = pgTable('project_activity_parents', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	templateParentId: text('template_parent_id'),
	stage: text('stage').notNull(),
	projectTaskName: text('project_task_name').notNull(),
	status: text('status').notNull().default("not_started"),
	plannedStartDate: timestamp('planned_start_date', { precision: 3, withTimezone: true }),
	plannedDueDate: timestamp('planned_due_date', { precision: 3, withTimezone: true }),
	closedAt: timestamp('closed_at', { precision: 3, withTimezone: true }),
	closedById: text('closed_by_id'),
	progressPercent: integer('progress_percent').notNull().default(0),
	hasBlocked: boolean('has_blocked').notNull().default(false),
	hasOverdue: boolean('has_overdue').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectActivityParent) => ({
	'ProjectActivityParent_project_fkey': foreignKey({
		name: 'project_activity_parent_project_fkey',
		columns: [ProjectActivityParent.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectActivityParent_templateParent_fkey': foreignKey({
		name: 'project_activity_parent_template_parent_fkey',
		columns: [ProjectActivityParent.templateParentId],
		foreignColumns: [ActivityTemplateParent.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityParent_closedBy_fkey': foreignKey({
		name: 'project_activity_parent_closed_by_fkey',
		columns: [ProjectActivityParent.closedById],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityParent_projectId_stage_projectTaskName_unique_idx': uniqueIndex('project_activity_parent_project_id_stage_project_task_name_key')
		.on(ProjectActivityParent.projectId, ProjectActivityParent.stage, ProjectActivityParent.projectTaskName),
	'project_activity_parents_project_id_stage_idx': index('project_activity_parents_project_id_stage_idx').on(ProjectActivityParent.projectId, ProjectActivityParent.stage),
	'project_activity_parents_project_id_status_idx': index('project_activity_parents_project_id_status_idx').on(ProjectActivityParent.projectId, ProjectActivityParent.status),
	'project_activity_parents_template_parent_id_idx': index('project_activity_parents_template_parent_id_idx').on(ProjectActivityParent.templateParentId),
	'project_activity_parents_has_blocked_idx': index('project_activity_parents_has_blocked_idx').on(ProjectActivityParent.hasBlocked),
	'project_activity_parents_has_overdue_idx': index('project_activity_parents_has_overdue_idx').on(ProjectActivityParent.hasOverdue),
}));

export const ProjectActivityChild = pgTable('project_activity_children', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	parentId: text('parent_id').notNull(),
	templateChildId: text('template_child_id'),
	thirdLevelPlan: text('third_level_plan').notNull(),
	ownerRole: text('owner_role').notNull(),
	responsibleRoleId: text('responsible_role_id'),
	assigneeUserId: text('assignee_user_id'),
	status: text('status').notNull().default("not_started"),
	requiresDeliverable: boolean('requires_deliverable').notNull().default(false),
	requiresAttachment: boolean('requires_attachment').notNull().default(false),
	requiresNote: boolean('requires_note').notNull().default(false),
	deliverableName: text('deliverable_name'),
	deliverableUrl: text('deliverable_url'),
	completionNote: text('completion_note'),
	blockerNote: text('blocker_note'),
	isBlocked: boolean('is_blocked').notNull().default(false),
	isNotApplicable: boolean('is_not_applicable').notNull().default(false),
	notApplicableReason: text('not_applicable_reason'),
	returnedAt: timestamp('returned_at', { precision: 3, withTimezone: true }),
	returnedById: text('returned_by_id'),
	returnReason: text('return_reason'),
	isManuallyAdded: boolean('is_manually_added').notNull().default(false),
	plannedDueDateOverride: timestamp('planned_due_date_override', { precision: 3, withTimezone: true }),
	completedAt: timestamp('completed_at', { precision: 3, withTimezone: true }),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectActivityChild) => ({
	'ProjectActivityChild_project_fkey': foreignKey({
		name: 'project_activity_child_project_fkey',
		columns: [ProjectActivityChild.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectActivityChild_parent_fkey': foreignKey({
		name: 'project_activity_child_parent_fkey',
		columns: [ProjectActivityChild.parentId],
		foreignColumns: [ProjectActivityParent.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ProjectActivityChild_templateChild_fkey': foreignKey({
		name: 'project_activity_child_template_child_fkey',
		columns: [ProjectActivityChild.templateChildId],
		foreignColumns: [ActivityTemplateChild.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityChild_responsibleRole_fkey': foreignKey({
		name: 'project_activity_child_responsible_role_fkey',
		columns: [ProjectActivityChild.responsibleRoleId],
		foreignColumns: [PositionRole.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityChild_assignee_fkey': foreignKey({
		name: 'project_activity_child_assignee_fkey',
		columns: [ProjectActivityChild.assigneeUserId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityChild_returnedBy_fkey': foreignKey({
		name: 'project_activity_child_returned_by_fkey',
		columns: [ProjectActivityChild.returnedById],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ProjectActivityChild_parentId_thirdLevelPlan_ownerRole_unique_idx': uniqueIndex('project_activity_child_parent_id_third_level_plan_owner_role_key')
		.on(ProjectActivityChild.parentId, ProjectActivityChild.thirdLevelPlan, ProjectActivityChild.ownerRole),
	'project_activity_children_project_id_owner_role_idx': index('project_activity_children_project_id_owner_role_idx').on(ProjectActivityChild.projectId, ProjectActivityChild.ownerRole),
	'project_activity_children_project_id_idx': index('project_activity_children_project_id_idx').on(ProjectActivityChild.projectId),
	'project_activity_children_project_id_status_idx': index('project_activity_children_project_id_status_idx').on(ProjectActivityChild.projectId, ProjectActivityChild.status),
	'project_activity_children_project_id_assignee_user_id_idx': index('project_activity_children_project_id_assignee_user_id_idx').on(ProjectActivityChild.projectId, ProjectActivityChild.assigneeUserId),
	'project_activity_children_responsible_role_id_idx': index('project_activity_children_responsible_role_id_idx').on(ProjectActivityChild.responsibleRoleId),
	'project_activity_children_template_child_id_idx': index('project_activity_children_template_child_id_idx').on(ProjectActivityChild.templateChildId),
	'project_activity_children_parent_id_sort_order_idx': index('project_activity_children_parent_id_sort_order_idx').on(ProjectActivityChild.parentId, ProjectActivityChild.sortOrder),
	'project_activity_children_is_blocked_idx': index('project_activity_children_is_blocked_idx').on(ProjectActivityChild.isBlocked),
	'project_activity_children_is_not_applicable_idx': index('project_activity_children_is_not_applicable_idx').on(ProjectActivityChild.isNotApplicable),
}));

export const ActivityEvent = pgTable('activity_events', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	parentId: text('parent_id'),
	childId: text('child_id'),
	actorUserId: text('actor_user_id'),
	actorRole: text('actor_role'),
	actionType: text('action_type').notNull(),
	beforeValue: text('before_value'),
	afterValue: text('after_value'),
	note: text('note'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (ActivityEvent) => ({
	'ActivityEvent_project_fkey': foreignKey({
		name: 'activity_event_project_fkey',
		columns: [ActivityEvent.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityEvent_parent_fkey': foreignKey({
		name: 'activity_event_parent_fkey',
		columns: [ActivityEvent.parentId],
		foreignColumns: [ProjectActivityParent.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityEvent_child_fkey': foreignKey({
		name: 'activity_event_child_fkey',
		columns: [ActivityEvent.childId],
		foreignColumns: [ProjectActivityChild.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityEvent_actor_fkey': foreignKey({
		name: 'activity_event_actor_fkey',
		columns: [ActivityEvent.actorUserId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'activity_events_project_id_created_at_idx': index('activity_events_project_id_created_at_idx').on(ActivityEvent.projectId, ActivityEvent.createdAt),
	'activity_events_parent_id_created_at_idx': index('activity_events_parent_id_created_at_idx').on(ActivityEvent.parentId, ActivityEvent.createdAt),
	'activity_events_child_id_created_at_idx': index('activity_events_child_id_created_at_idx').on(ActivityEvent.childId, ActivityEvent.createdAt),
	'activity_events_actor_user_id_idx': index('activity_events_actor_user_id_idx').on(ActivityEvent.actorUserId),
	'activity_events_action_type_idx': index('activity_events_action_type_idx').on(ActivityEvent.actionType),
}));

export const ActivityAttachment = pgTable('activity_attachments', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	childId: text('child_id').notNull(),
	fileName: text('file_name').notNull(),
	storagePath: text('storage_path').notNull(),
	mimeType: text('mime_type'),
	sizeBytes: integer('size_bytes'),
	uploadedById: text('uploaded_by_id').notNull(),
	deletedAt: timestamp('deleted_at', { precision: 3, withTimezone: true }),
	deletedById: text('deleted_by_id'),
	deleteReason: text('delete_reason'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (ActivityAttachment) => ({
	'ActivityAttachment_project_fkey': foreignKey({
		name: 'activity_attachment_project_fkey',
		columns: [ActivityAttachment.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityAttachment_child_fkey': foreignKey({
		name: 'activity_attachment_child_fkey',
		columns: [ActivityAttachment.childId],
		foreignColumns: [ProjectActivityChild.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ActivityAttachment_uploadedBy_fkey': foreignKey({
		name: 'activity_attachment_uploaded_by_fkey',
		columns: [ActivityAttachment.uploadedById],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'ActivityAttachment_deletedBy_fkey': foreignKey({
		name: 'activity_attachment_deleted_by_fkey',
		columns: [ActivityAttachment.deletedById],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'activity_attachments_project_id_created_at_idx': index('activity_attachments_project_id_created_at_idx').on(ActivityAttachment.projectId, ActivityAttachment.createdAt),
	'activity_attachments_child_id_idx': index('activity_attachments_child_id_idx').on(ActivityAttachment.childId),
	'activity_attachments_uploaded_by_id_idx': index('activity_attachments_uploaded_by_id_idx').on(ActivityAttachment.uploadedById),
	'activity_attachments_deleted_at_idx': index('activity_attachments_deleted_at_idx').on(ActivityAttachment.deletedAt),
}));

export const Notification = pgTable('notifications', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	recipientUserId: text('recipient_user_id').notNull(),
	projectId: text('project_id'),
	childId: text('child_id'),
	type: text('type').notNull(),
	title: text('title').notNull(),
	body: text('body'),
	status: text('status').notNull().default("unread"),
	createdById: text('created_by_id'),
	readAt: timestamp('read_at', { precision: 3, withTimezone: true }),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (Notification) => ({
	'Notification_recipient_fkey': foreignKey({
		name: 'notification_recipient_fkey',
		columns: [Notification.recipientUserId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'Notification_project_fkey': foreignKey({
		name: 'notification_project_fkey',
		columns: [Notification.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'Notification_child_fkey': foreignKey({
		name: 'notification_child_fkey',
		columns: [Notification.childId],
		foreignColumns: [ProjectActivityChild.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'Notification_createdBy_fkey': foreignKey({
		name: 'notification_created_by_fkey',
		columns: [Notification.createdById],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'notifications_recipient_user_id_status_created_at_idx': index('notifications_recipient_user_id_status_created_at_idx').on(Notification.recipientUserId, Notification.status, Notification.createdAt),
	'notifications_project_id_idx': index('notifications_project_id_idx').on(Notification.projectId),
	'notifications_child_id_idx': index('notifications_child_id_idx').on(Notification.childId),
	'notifications_type_idx': index('notifications_type_idx').on(Notification.type),
}));

export const StageGateRecord = pgTable('stage_gate_records', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	stage: text('stage').notNull(),
	status: text('status').notNull().default("pending"),
	plannedStartDate: timestamp('planned_start_date', { precision: 3, withTimezone: true }),
	plannedDueDate: timestamp('planned_due_date', { precision: 3, withTimezone: true }),
	passedAt: timestamp('passed_at', { precision: 3, withTimezone: true }),
	passedById: text('passed_by_id'),
	conditionReleaseNote: text('condition_release_note'),
	blockerSummary: text('blocker_summary'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (StageGateRecord) => ({
	'StageGateRecord_project_fkey': foreignKey({
		name: 'stage_gate_record_project_fkey',
		columns: [StageGateRecord.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'StageGateRecord_projectId_stage_unique_idx': uniqueIndex('stage_gate_record_project_id_stage_key')
		.on(StageGateRecord.projectId, StageGateRecord.stage),
	'stage_gate_records_project_id_status_idx': index('stage_gate_records_project_id_status_idx').on(StageGateRecord.projectId, StageGateRecord.status),
	'stage_gate_records_stage_idx': index('stage_gate_records_stage_idx').on(StageGateRecord.stage),
}));

export const ProjectTrialPlanNode = pgTable('project_trial_plan_nodes', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	projectId: text('project_id').notNull(),
	item: text('item').notNull(),
	plannedStartDate: timestamp('planned_start_date', { precision: 3, withTimezone: true }),
	plannedDueDate: timestamp('planned_due_date', { precision: 3, withTimezone: true }),
	note: text('note'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ProjectTrialPlanNode) => ({
	'ProjectTrialPlanNode_project_fkey': foreignKey({
		name: 'project_trial_plan_node_project_fkey',
		columns: [ProjectTrialPlanNode.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'project_trial_plan_nodes_project_id_sort_order_idx': index('project_trial_plan_nodes_project_id_sort_order_idx').on(ProjectTrialPlanNode.projectId, ProjectTrialPlanNode.sortOrder),
}));

export const Task = pgTable('tasks', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	title: text('title').notNull(),
	description: text('description'),
	status: text('status').notNull().default("todo"),
	priority: text('priority').notNull().default("medium"),
	projectId: text('project_id').notNull(),
	stageId: text('stage_id'),
	assigneeMemberId: text('assignee_member_id'),
	creatorId: text('creator_id').notNull(),
	completedAt: timestamp('completed_at', { precision: 3, withTimezone: true }),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
	externalSource: text('external_source'),
	externalId: text('external_id'),
	syncAt: timestamp('sync_at', { precision: 3, withTimezone: true })
}, (Task) => ({
	'Task_project_fkey': foreignKey({
		name: 'task_project_fkey',
		columns: [Task.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'Task_stage_fkey': foreignKey({
		name: 'task_stage_fkey',
		columns: [Task.stageId],
		foreignColumns: [ProjectStage.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'Task_assigneeMember_fkey': foreignKey({
		name: 'task_assignee_member_fkey',
		columns: [Task.assigneeMemberId],
		foreignColumns: [ProjectMember.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'Task_creator_fkey': foreignKey({
		name: 'task_creator_fkey',
		columns: [Task.creatorId],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'tasks_project_id_idx': index('tasks_project_id_idx').on(Task.projectId),
	'tasks_status_idx': index('tasks_status_idx').on(Task.status),
	'tasks_assignee_member_id_status_idx': index('tasks_assignee_member_id_status_idx').on(Task.assigneeMemberId, Task.status),
	'tasks_creator_id_idx': index('tasks_creator_id_idx').on(Task.creatorId),
}));

export const TaskStatusChange = pgTable('task_status_changes', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	taskId: text('task_id').notNull(),
	fromStatus: text('from_status'),
	toStatus: text('to_status').notNull(),
	changedBy: text('changed_by').notNull(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (TaskStatusChange) => ({
	'TaskStatusChange_task_fkey': foreignKey({
		name: 'task_status_change_task_fkey',
		columns: [TaskStatusChange.taskId],
		foreignColumns: [Task.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'task_status_changes_task_id_created_at_idx': index('task_status_changes_task_id_created_at_idx').on(TaskStatusChange.taskId, TaskStatusChange.createdAt),
	'task_status_changes_changed_by_idx': index('task_status_changes_changed_by_idx').on(TaskStatusChange.changedBy),
}));

export const ComponentConfig = pgTable('component_configs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	name: text('name').notNull().unique(),
	path: text('path').notNull().unique(),
	enabled: boolean('enabled').notNull().default(true),
	order: integer('order').notNull().default(0),
	policy: text('policy').notNull().default("whitelist"),
	description: text('description'),
	dependsOnId: text('depends_on_id'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (ComponentConfig) => ({
	'ComponentConfig_dependsOn_fkey': foreignKey({
		name: 'component_config_depends_on_fkey',
		columns: [ComponentConfig.dependsOnId],
		foreignColumns: [ComponentConfig.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'component_configs_enabled_idx': index('component_configs_enabled_idx').on(ComponentConfig.enabled),
	'component_configs_order_idx': index('component_configs_order_idx').on(ComponentConfig.order),
	'component_configs_depends_on_id_idx': index('component_configs_depends_on_id_idx').on(ComponentConfig.dependsOnId),
}));

export const ObservabilityEvent = pgTable('observability_events', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	traceId: text('trace_id').notNull(),
	spanId: text('span_id'),
	parentSpanId: text('parent_span_id'),
	eventType: text('event_type').notNull(),
	path: text('path'),
	method: text('method'),
	userId: text('user_id'),
	projectId: text('project_id'),
	statusCode: integer('status_code'),
	durationMs: integer('duration_ms'),
	requestBody: text('request_body'),
	responseSummary: text('response_summary'),
	errorMessage: text('error_message'),
	errorStack: text('error_stack'),
	timestamp: timestamp('timestamp', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (ObservabilityEvent) => ({
	'ObservabilityEvent_user_fkey': foreignKey({
		name: 'observability_event_user_fkey',
		columns: [ObservabilityEvent.userId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ObservabilityEvent_project_fkey': foreignKey({
		name: 'observability_event_project_fkey',
		columns: [ObservabilityEvent.projectId],
		foreignColumns: [Project.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'observability_events_trace_id_timestamp_idx': index('observability_events_trace_id_timestamp_idx').on(ObservabilityEvent.traceId, ObservabilityEvent.timestamp),
	'observability_events_event_type_idx': index('observability_events_event_type_idx').on(ObservabilityEvent.eventType),
	'observability_events_timestamp_idx': index('observability_events_timestamp_idx').on(ObservabilityEvent.timestamp),
	'observability_events_user_id_idx': index('observability_events_user_id_idx').on(ObservabilityEvent.userId),
}));

export const AiResourceModuleSettings = pgTable('ai_resource_module_settings', {
	id: text('id').notNull().primaryKey().default("default"),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
});

export const AiResourceMigrationRun = pgTable('ai_resource_migration_runs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	status: text('status').notNull(),
	reportPath: text('report_path'),
	operatorId: text('operator_id'),
	startedAt: timestamp('started_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	finishedAt: timestamp('finished_at', { precision: 3, withTimezone: true }),
	errorMessage: text('error_message')
}, (AiResourceMigrationRun) => ({
	'AiResourceMigrationRun_operator_fkey': foreignKey({
		name: 'ai_resource_migration_run_operator_fkey',
		columns: [AiResourceMigrationRun.operatorId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ai_resource_migration_runs_status_idx': index('ai_resource_migration_runs_status_idx').on(AiResourceMigrationRun.status),
	'ai_resource_migration_runs_started_at_idx': index('ai_resource_migration_runs_started_at_idx').on(AiResourceMigrationRun.startedAt),
}));

export const AiResourceMigrationItem = pgTable('ai_resource_migration_items', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	runId: text('run_id').notNull(),
	entityType: text('entity_type').notNull(),
	legacyId: text('legacy_id').notNull(),
	targetId: text('target_id').notNull(),
	action: text('action').notNull(),
	beforeData: text('before_data'),
	afterHash: text('after_hash')
}, (AiResourceMigrationItem) => ({
	'AiResourceMigrationItem_run_fkey': foreignKey({
		name: 'ai_resource_migration_item_run_fkey',
		columns: [AiResourceMigrationItem.runId],
		foreignColumns: [AiResourceMigrationRun.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceMigrationItem_runId_entityType_legacyId_unique_idx': uniqueIndex('ai_resource_migration_item_run_id_entity_type_legacy_id_key')
		.on(AiResourceMigrationItem.runId, AiResourceMigrationItem.entityType, AiResourceMigrationItem.legacyId),
	'ai_resource_migration_items_run_id_idx': index('ai_resource_migration_items_run_id_idx').on(AiResourceMigrationItem.runId),
	'ai_resource_migration_items_target_id_idx': index('ai_resource_migration_items_target_id_idx').on(AiResourceMigrationItem.targetId),
}));

export const AiResource = pgTable('ai_resources', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	legacyId: text('legacy_id').unique(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	summary: text('summary').notNull(),
	tags: text('tags').notNull().default(''),
	ownerName: text('owner_name').notNull(),
	ownerId: text('owner_id').notNull(),
	visibilityScope: text('visibility_scope').notNull().default("ALL"),
	visibleDeptIds: text('visible_dept_ids').notNull().default(''),
	visibleUserIds: text('visible_user_ids').notNull().default(''),
	status: text('status').notNull().default("PUBLISHED"),
	archivedFromStatus: text('archived_from_status'),
	resourceUrl: text('resource_url'),
	content: text('content').notNull(),
	attachments: text('attachments'),
	extension: text('extension'),
	extractedText: text('extracted_text'),
	currentVersion: integer('current_version').default(1).notNull().default(1),
	viewCount: integer('view_count').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
	createdById: text('created_by_id').notNull()
}, (AiResource) => ({
	'AiResource_createdBy_fkey': foreignKey({
		name: 'ai_resource_created_by_fkey',
		columns: [AiResource.createdById],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'AiResource_owner_fkey': foreignKey({
		name: 'ai_resource_owner_fkey',
		columns: [AiResource.ownerId],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'ai_resources_type_idx': index('ai_resources_type_idx').on(AiResource.type),
	'ai_resources_status_idx': index('ai_resources_status_idx').on(AiResource.status),
	'ai_resources_created_by_id_idx': index('ai_resources_created_by_id_idx').on(AiResource.createdById),
	'ai_resources_owner_id_idx': index('ai_resources_owner_id_idx').on(AiResource.ownerId),
	'ai_resources_updated_at_idx': index('ai_resources_updated_at_idx').on(AiResource.updatedAt),
	'ai_resources_created_at_idx': index('ai_resources_created_at_idx').on(AiResource.createdAt),
	'ai_resources_name_trgm_idx': index('ai_resources_name_trgm_idx')
		.using('gin', AiResource.name.op('gin_trgm_ops')),
	'ai_resources_summary_trgm_idx': index('ai_resources_summary_trgm_idx')
		.using('gin', AiResource.summary.op('gin_trgm_ops')),
	'ai_resources_tags_trgm_idx': index('ai_resources_tags_trgm_idx')
		.using('gin', AiResource.tags.op('gin_trgm_ops')),
	'ai_resources_owner_name_trgm_idx': index('ai_resources_owner_name_trgm_idx')
		.using('gin', AiResource.ownerName.op('gin_trgm_ops')),
	'ai_resources_content_trgm_idx': index('ai_resources_content_trgm_idx')
		.using('gin', AiResource.content.op('gin_trgm_ops')),
	'ai_resources_extracted_text_trgm_idx': index('ai_resources_extracted_text_trgm_idx')
		.using('gin', AiResource.extractedText.op('gin_trgm_ops')),
}));

export const AiResourceReviewRequest = pgTable('ai_resource_review_requests', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	legacyId: text('legacy_id').unique(),
	type: text('type').notNull(),
	status: text('status').notNull().default("PENDING"),
	resourceId: text('resource_id'),
	proposedData: text('proposed_data').notNull(),
	updateSummary: text('update_summary').notNull(),
	changedFields: text('changed_fields').notNull().default(''),
	rejectReason: text('reject_reason'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	reviewedAt: timestamp('reviewed_at', { precision: 3, withTimezone: true }),
	dingtalkTodoId: text('dingtalk_todo_id'),
	dingtalkTodoUnionId: text('dingtalk_todo_union_id'),
	dingtalkReworkTodoId: text('dingtalk_rework_todo_id'),
	dingtalkReworkTodoUnionId: text('dingtalk_rework_todo_union_id'),
	externalTodoProvider: text('external_todo_provider'),
	externalTodoId: text('external_todo_id'),
	externalTodoAssigneeId: text('external_todo_assignee_id'),
	externalReworkTodoProvider: text('external_rework_todo_provider'),
	externalReworkTodoId: text('external_rework_todo_id'),
	externalReworkTodoAssigneeId: text('external_rework_todo_assignee_id'),
	requesterId: text('requester_id').notNull(),
	reviewerId: text('reviewer_id')
}, (AiResourceReviewRequest) => ({
	'AiResourceReviewRequest_requester_fkey': foreignKey({
		name: 'ai_resource_review_request_requester_fkey',
		columns: [AiResourceReviewRequest.requesterId],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'AiResourceReviewRequest_reviewer_fkey': foreignKey({
		name: 'ai_resource_review_request_reviewer_fkey',
		columns: [AiResourceReviewRequest.reviewerId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'AiResourceReviewRequest_resource_fkey': foreignKey({
		name: 'ai_resource_review_request_resource_fkey',
		columns: [AiResourceReviewRequest.resourceId],
		foreignColumns: [AiResource.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ai_resource_review_requests_status_idx': index('ai_resource_review_requests_status_idx').on(AiResourceReviewRequest.status),
	'ai_resource_review_requests_requester_id_idx': index('ai_resource_review_requests_requester_id_idx').on(AiResourceReviewRequest.requesterId),
	'ai_resource_review_requests_reviewer_id_idx': index('ai_resource_review_requests_reviewer_id_idx').on(AiResourceReviewRequest.reviewerId),
	'ai_resource_review_requests_resource_id_idx': index('ai_resource_review_requests_resource_id_idx').on(AiResourceReviewRequest.resourceId),
}));

export const AppSetting = pgTable('app_settings', {
	key: text('key').notNull().primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
	updatedById: text('updated_by_id')
});

export const AiResourceUpdateLog = pgTable('ai_resource_update_logs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	legacyId: text('legacy_id').unique(),
	resourceId: text('resource_id').notNull(),
	actorId: text('actor_id').notNull(),
	reviewerId: text('reviewer_id'),
	reviewId: text('review_id'),
	action: text('action').notNull(),
	result: text('result').notNull(),
	updateSummary: text('update_summary').notNull(),
	changedFields: text('changed_fields').notNull().default(''),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceUpdateLog) => ({
	'AiResourceUpdateLog_resource_fkey': foreignKey({
		name: 'ai_resource_update_log_resource_fkey',
		columns: [AiResourceUpdateLog.resourceId],
		foreignColumns: [AiResource.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceUpdateLog_actor_fkey': foreignKey({
		name: 'ai_resource_update_log_actor_fkey',
		columns: [AiResourceUpdateLog.actorId],
		foreignColumns: [User.id]
	})
		.onDelete('restrict')
		.onUpdate('cascade'),
	'AiResourceUpdateLog_reviewer_fkey': foreignKey({
		name: 'ai_resource_update_log_reviewer_fkey',
		columns: [AiResourceUpdateLog.reviewerId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ai_resource_update_logs_resource_id_idx': index('ai_resource_update_logs_resource_id_idx').on(AiResourceUpdateLog.resourceId),
	'ai_resource_update_logs_created_at_idx': index('ai_resource_update_logs_created_at_idx').on(AiResourceUpdateLog.createdAt),
}));

export const AiResourceFavoriteTag = pgTable('ai_resource_favorite_tags', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceFavoriteTag) => ({
	'AiResourceFavoriteTag_user_fkey': foreignKey({
		name: 'ai_resource_favorite_tag_user_fkey',
		columns: [AiResourceFavoriteTag.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceFavoriteTag_userId_name_unique_idx': uniqueIndex('ai_resource_favorite_tag_user_id_name_key')
		.on(AiResourceFavoriteTag.userId, AiResourceFavoriteTag.name),
	'ai_resource_favorite_tags_user_id_sort_order_idx': index('ai_resource_favorite_tags_user_id_sort_order_idx').on(AiResourceFavoriteTag.userId, AiResourceFavoriteTag.sortOrder),
}));

export const AiResourceFavorite = pgTable('ai_resource_favorites', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	legacyId: text('legacy_id').unique(),
	userId: text('user_id').notNull(),
	resourceId: text('resource_id').notNull(),
	tagId: text('tag_id'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceFavorite) => ({
	'AiResourceFavorite_user_fkey': foreignKey({
		name: 'ai_resource_favorite_user_fkey',
		columns: [AiResourceFavorite.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceFavorite_resource_fkey': foreignKey({
		name: 'ai_resource_favorite_resource_fkey',
		columns: [AiResourceFavorite.resourceId],
		foreignColumns: [AiResource.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceFavorite_tag_fkey': foreignKey({
		name: 'ai_resource_favorite_tag_fkey',
		columns: [AiResourceFavorite.tagId],
		foreignColumns: [AiResourceFavoriteTag.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'AiResourceFavorite_userId_resourceId_unique_idx': uniqueIndex('ai_resource_favorite_user_id_resource_id_key')
		.on(AiResourceFavorite.userId, AiResourceFavorite.resourceId),
	'ai_resource_favorites_user_id_idx': index('ai_resource_favorites_user_id_idx').on(AiResourceFavorite.userId),
	'ai_resource_favorites_user_id_sort_order_idx': index('ai_resource_favorites_user_id_sort_order_idx').on(AiResourceFavorite.userId, AiResourceFavorite.sortOrder),
	'ai_resource_favorites_resource_id_idx': index('ai_resource_favorites_resource_id_idx').on(AiResourceFavorite.resourceId),
	'ai_resource_favorites_tag_id_idx': index('ai_resource_favorites_tag_id_idx').on(AiResourceFavorite.tagId),
}));

export const AiResourceLike = pgTable('ai_resource_likes', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull(),
	resourceId: text('resource_id').notNull(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceLike) => ({
	'AiResourceLike_user_fkey': foreignKey({
		name: 'ai_resource_like_user_fkey',
		columns: [AiResourceLike.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceLike_resource_fkey': foreignKey({
		name: 'ai_resource_like_resource_fkey',
		columns: [AiResourceLike.resourceId],
		foreignColumns: [AiResource.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceLike_userId_resourceId_unique_idx': uniqueIndex('ai_resource_like_user_id_resource_id_key')
		.on(AiResourceLike.userId, AiResourceLike.resourceId),
	'ai_resource_likes_user_id_idx': index('ai_resource_likes_user_id_idx').on(AiResourceLike.userId),
	'ai_resource_likes_resource_id_idx': index('ai_resource_likes_resource_id_idx').on(AiResourceLike.resourceId),
}));

export const AiResourceComment = pgTable('ai_resource_comments', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	resourceId: text('resource_id').notNull(),
	userId: text('user_id').notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceComment) => ({
	'AiResourceComment_resource_fkey': foreignKey({
		name: 'ai_resource_comment_resource_fkey',
		columns: [AiResourceComment.resourceId],
		foreignColumns: [AiResource.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceComment_user_fkey': foreignKey({
		name: 'ai_resource_comment_user_fkey',
		columns: [AiResourceComment.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'ai_resource_comments_resource_id_created_at_idx': index('ai_resource_comments_resource_id_created_at_idx').on(AiResourceComment.resourceId, AiResourceComment.createdAt),
	'ai_resource_comments_user_id_idx': index('ai_resource_comments_user_id_idx').on(AiResourceComment.userId),
}));

export const AiResourceMembership = pgTable('ai_resource_memberships', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	userId: text('user_id').notNull().unique(),
	role: text('role').notNull(),
	updatedById: text('updated_by_id'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
}, (AiResourceMembership) => ({
	'AiResourceMembership_user_fkey': foreignKey({
		name: 'ai_resource_membership_user_fkey',
		columns: [AiResourceMembership.userId],
		foreignColumns: [User.id]
	})
		.onDelete('cascade')
		.onUpdate('cascade'),
	'AiResourceMembership_updatedBy_fkey': foreignKey({
		name: 'ai_resource_membership_updated_by_fkey',
		columns: [AiResourceMembership.updatedById],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ai_resource_memberships_role_idx': index('ai_resource_memberships_role_idx').on(AiResourceMembership.role),
}));

export const AiResourceRoleAudit = pgTable('ai_resource_role_audits', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	membershipId: text('membership_id'),
	subjectUserId: text('subject_user_id'),
	subjectUserIdSnapshot: text('subject_user_id_snapshot').notNull(),
	subjectUsernameSnapshot: text('subject_username_snapshot').notNull(),
	actorId: text('actor_id'),
	fromRole: text('from_role'),
	toRole: text('to_role'),
	action: text('action').notNull(),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceRoleAudit) => ({
	'AiResourceRoleAudit_membership_fkey': foreignKey({
		name: 'ai_resource_role_audit_membership_fkey',
		columns: [AiResourceRoleAudit.membershipId],
		foreignColumns: [AiResourceMembership.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'AiResourceRoleAudit_subjectUser_fkey': foreignKey({
		name: 'ai_resource_role_audit_subject_user_fkey',
		columns: [AiResourceRoleAudit.subjectUserId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'AiResourceRoleAudit_actor_fkey': foreignKey({
		name: 'ai_resource_role_audit_actor_fkey',
		columns: [AiResourceRoleAudit.actorId],
		foreignColumns: [User.id]
	})
		.onDelete('set null')
		.onUpdate('cascade'),
	'ai_resource_role_audits_subject_user_id_idx': index('ai_resource_role_audits_subject_user_id_idx').on(AiResourceRoleAudit.subjectUserId),
	'ai_resource_role_audits_created_at_idx': index('ai_resource_role_audits_created_at_idx').on(AiResourceRoleAudit.createdAt),
}));

export const AiResourceAuditLog = pgTable('ai_resource_audit_logs', {
	id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
	actorId: text('actor_id'),
	actorUsernameSnapshot: text('actor_username_snapshot').notNull(),
	action: text('action').notNull(),
	module: text('module').notNull().default('AI_RESOURCE'),
	targetType: text('target_type').notNull(),
	targetId: text('target_id'),
	resourceId: text('resource_id'),
	reviewId: text('review_id'),
	result: text('result').notNull(),
	reason: text('reason'),
	beforeData: text('before_data'),
	afterData: text('after_data'),
	traceId: text('trace_id'),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow()
}, (AiResourceAuditLog) => ({
	'ai_resource_audit_logs_actor_id_idx': index('ai_resource_audit_logs_actor_id_idx').on(AiResourceAuditLog.actorId),
	'ai_resource_audit_logs_action_idx': index('ai_resource_audit_logs_action_idx').on(AiResourceAuditLog.action),
	'ai_resource_audit_logs_target_idx': index('ai_resource_audit_logs_target_idx').on(AiResourceAuditLog.targetType, AiResourceAuditLog.targetId),
	'ai_resource_audit_logs_resource_id_idx': index('ai_resource_audit_logs_resource_id_idx').on(AiResourceAuditLog.resourceId),
	'ai_resource_audit_logs_created_at_idx': index('ai_resource_audit_logs_created_at_idx').on(AiResourceAuditLog.createdAt),
}));

export const UserRelations = relations(User, ({ many }) => ({
	identities: many(UserIdentity, {
		relationName: 'UserToUserIdentity'
	}),
	projectMembers: many(ProjectMember, {
		relationName: 'ProjectMemberToUser'
	}),
	dingtalkDepartments: many(UserDingTalkDepartment, {
		relationName: 'UserToDingTalkDepartment'
	}),
	createdTasks: many(Task, {
		relationName: 'TaskCreator'
	}),
	closedActivityParents: many(ProjectActivityParent, {
		relationName: 'ActivityParentCloser'
	}),
	positionBinding: many(UserPosition, {
		relationName: 'UserToUserPosition'
	}),
	projectPositionAssignments: many(ProjectPositionAssignment, {
		relationName: 'ProjectPositionAssignmentToUser'
	}),
	assignedActivityChildren: many(ProjectActivityChild, {
		relationName: 'ActivityChildAssignee'
	}),
	returnedActivityChildren: many(ProjectActivityChild, {
		relationName: 'ActivityChildReturner'
	}),
	uploadedActivityAttachments: many(ActivityAttachment, {
		relationName: 'ActivityAttachmentUploader'
	}),
	deletedActivityAttachments: many(ActivityAttachment, {
		relationName: 'ActivityAttachmentDeleter'
	}),
	notifications: many(Notification, {
		relationName: 'NotificationRecipient'
	}),
	createdNotifications: many(Notification, {
		relationName: 'NotificationCreator'
	}),
	activityEvents: many(ActivityEvent, {
		relationName: 'ActivityEventToUser'
	}),
	events: many(ObservabilityEvent, {
		relationName: 'ObservabilityEventToUser'
	}),
	feedbackLogs: many(FeedbackLog, {
		relationName: 'FeedbackLogToUser'
	}),
	authLoginLogs: many(AuthLoginLog, {
		relationName: 'AuthLoginLogToUser'
	}),
	aiResourceMembership: many(AiResourceMembership, {
		relationName: 'AiResourceMembershipToUser'
	}),
	aiResourcesCreated: many(AiResource, {
		relationName: 'AiResourceCreator'
	}),
	aiResourcesOwned: many(AiResource, {
		relationName: 'AiResourceOwner'
	}),
	aiResourceReviewsRequested: many(AiResourceReviewRequest, {
		relationName: 'AiResourceReviewRequester'
	}),
	aiResourceReviewsHandled: many(AiResourceReviewRequest, {
		relationName: 'AiResourceReviewReviewer'
	}),
	aiResourceUpdateLogsAsActor: many(AiResourceUpdateLog, {
		relationName: 'AiResourceUpdateActor'
	}),
	aiResourceUpdateLogsAsReviewer: many(AiResourceUpdateLog, {
		relationName: 'AiResourceUpdateReviewer'
	}),
	aiResourceFavorites: many(AiResourceFavorite, {
		relationName: 'AiResourceFavoriteToUser'
	}),
	aiResourceFavoriteTags: many(AiResourceFavoriteTag, {
		relationName: 'AiResourceFavoriteTagToUser'
	}),
	aiResourceLikes: many(AiResourceLike, {
		relationName: 'AiResourceLikeToUser'
	}),
	aiResourceComments: many(AiResourceComment, {
		relationName: 'AiResourceCommentToUser'
	}),
	aiResourceRoleAuditsAsSubject: many(AiResourceRoleAudit, {
		relationName: 'AiResourceRoleAuditSubject'
	}),
	aiResourceRoleAuditsAsActor: many(AiResourceRoleAudit, {
		relationName: 'AiResourceRoleAuditActor'
	}),
	aiResourceMembershipUpdates: many(AiResourceMembership, {
		relationName: 'AiResourceMembershipUpdater'
	}),
	aiResourceMigrationRuns: many(AiResourceMigrationRun, {
		relationName: 'AiResourceMigrationOperator'
	})
}));

export const FeedbackLogRelations = relations(FeedbackLog, ({ one }) => ({
	user: one(User, {
		relationName: 'FeedbackLogToUser',
		fields: [FeedbackLog.userId],
		references: [User.id]
	})
}));

export const AuthLoginLogRelations = relations(AuthLoginLog, ({ one }) => ({
	user: one(User, {
		relationName: 'AuthLoginLogToUser',
		fields: [AuthLoginLog.userId],
		references: [User.id]
	})
}));

export const UserIdentityRelations = relations(UserIdentity, ({ one }) => ({
	user: one(User, {
		relationName: 'UserToUserIdentity',
		fields: [UserIdentity.userId],
		references: [User.id]
	})
}));

export const DingTalkDepartmentRelations = relations(DingTalkDepartment, ({ many }) => ({
	userDepartments: many(UserDingTalkDepartment, {
		relationName: 'DingTalkDepartmentToUser'
	})
}));

export const UserDingTalkDepartmentRelations = relations(UserDingTalkDepartment, ({ one }) => ({
	user: one(User, {
		relationName: 'UserToDingTalkDepartment',
		fields: [UserDingTalkDepartment.userId],
		references: [User.id]
	}),
	department: one(DingTalkDepartment, {
		relationName: 'DingTalkDepartmentToUser',
		fields: [UserDingTalkDepartment.departmentId],
		references: [DingTalkDepartment.id]
	})
}));

export const ProjectRelations = relations(Project, ({ many }) => ({
	members: many(ProjectMember, {
		relationName: 'ProjectToProjectMember'
	}),
	stages: many(ProjectStage, {
		relationName: 'ProjectToProjectStage'
	}),
	tasks: many(Task, {
		relationName: 'ProjectToTask'
	}),
	positionAssignments: many(ProjectPositionAssignment, {
		relationName: 'ProjectToProjectPositionAssignment'
	}),
	activitySnapshotMeta: many(ProjectActivitySnapshotMeta, {
		relationName: 'ProjectToProjectActivitySnapshotMeta'
	}),
	activityParents: many(ProjectActivityParent, {
		relationName: 'ProjectToProjectActivityParent'
	}),
	activityChildren: many(ProjectActivityChild, {
		relationName: 'ProjectToProjectActivityChild'
	}),
	activityAttachments: many(ActivityAttachment, {
		relationName: 'ActivityAttachmentToProject'
	}),
	notifications: many(Notification, {
		relationName: 'NotificationToProject'
	}),
	stageGateRecords: many(StageGateRecord, {
		relationName: 'ProjectToStageGateRecord'
	}),
	trialPlanNodes: many(ProjectTrialPlanNode, {
		relationName: 'ProjectToProjectTrialPlanNode'
	}),
	activityEvents: many(ActivityEvent, {
		relationName: 'ActivityEventToProject'
	}),
	events: many(ObservabilityEvent, {
		relationName: 'ObservabilityEventToProject'
	})
}));

export const ProjectMemberRelations = relations(ProjectMember, ({ one, many }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectMember',
		fields: [ProjectMember.projectId],
		references: [Project.id]
	}),
	user: one(User, {
		relationName: 'ProjectMemberToUser',
		fields: [ProjectMember.userId],
		references: [User.id]
	}),
	assignedTasks: many(Task, {
		relationName: 'TaskAssignee'
	})
}));

export const PositionRoleRelations = relations(PositionRole, ({ many }) => ({
	userPositions: many(UserPosition, {
		relationName: 'PositionRoleToUserPosition'
	}),
	projectAssignments: many(ProjectPositionAssignment, {
		relationName: 'PositionRoleToProjectPositionAssignment'
	}),
	templateChildren: many(ActivityTemplateChild, {
		relationName: 'ActivityTemplateChildToPositionRole'
	}),
	activityChildren: many(ProjectActivityChild, {
		relationName: 'PositionRoleToProjectActivityChild'
	})
}));

export const UserPositionRelations = relations(UserPosition, ({ one }) => ({
	user: one(User, {
		relationName: 'UserToUserPosition',
		fields: [UserPosition.userId],
		references: [User.id]
	}),
	positionRole: one(PositionRole, {
		relationName: 'PositionRoleToUserPosition',
		fields: [UserPosition.positionRoleId],
		references: [PositionRole.id]
	})
}));

export const ProjectPositionAssignmentRelations = relations(ProjectPositionAssignment, ({ one }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectPositionAssignment',
		fields: [ProjectPositionAssignment.projectId],
		references: [Project.id]
	}),
	positionRole: one(PositionRole, {
		relationName: 'PositionRoleToProjectPositionAssignment',
		fields: [ProjectPositionAssignment.positionRoleId],
		references: [PositionRole.id]
	}),
	user: one(User, {
		relationName: 'ProjectPositionAssignmentToUser',
		fields: [ProjectPositionAssignment.userId],
		references: [User.id]
	})
}));

export const ProjectStageRelations = relations(ProjectStage, ({ one, many }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectStage',
		fields: [ProjectStage.projectId],
		references: [Project.id]
	}),
	tasks: many(Task, {
		relationName: 'ProjectStageToTask'
	})
}));

export const ActivityTemplateSetRelations = relations(ActivityTemplateSet, ({ one, many }) => ({
	latestPublishedVersion: one(ActivityTemplateVersion, {
		relationName: 'LatestPublishedTemplateVersion',
		fields: [ActivityTemplateSet.latestPublishedVersionId],
		references: [ActivityTemplateVersion.id]
	}),
	versions: many(ActivityTemplateVersion, {
		relationName: 'TemplateSetVersions'
	}),
	projectSnapshots: many(ProjectActivitySnapshotMeta, {
		relationName: 'ActivityTemplateSetToProjectActivitySnapshotMeta'
	})
}));

export const ActivityTemplateVersionRelations = relations(ActivityTemplateVersion, ({ one, many }) => ({
	templateSet: one(ActivityTemplateSet, {
		relationName: 'TemplateSetVersions',
		fields: [ActivityTemplateVersion.templateSetId],
		references: [ActivityTemplateSet.id]
	}),
	latestForSet: many(ActivityTemplateSet, {
		relationName: 'LatestPublishedTemplateVersion'
	}),
	stages: many(ActivityTemplateStage, {
		relationName: 'ActivityTemplateStageToActivityTemplateVersion'
	}),
	projectSnapshots: many(ProjectActivitySnapshotMeta, {
		relationName: 'ActivityTemplateVersionToProjectActivitySnapshotMeta'
	})
}));

export const ActivityTemplateStageRelations = relations(ActivityTemplateStage, ({ one, many }) => ({
	version: one(ActivityTemplateVersion, {
		relationName: 'ActivityTemplateStageToActivityTemplateVersion',
		fields: [ActivityTemplateStage.versionId],
		references: [ActivityTemplateVersion.id]
	}),
	parents: many(ActivityTemplateParent, {
		relationName: 'ActivityTemplateParentToActivityTemplateStage'
	})
}));

export const ActivityTemplateParentRelations = relations(ActivityTemplateParent, ({ one, many }) => ({
	stage: one(ActivityTemplateStage, {
		relationName: 'ActivityTemplateParentToActivityTemplateStage',
		fields: [ActivityTemplateParent.stageId],
		references: [ActivityTemplateStage.id]
	}),
	children: many(ActivityTemplateChild, {
		relationName: 'ActivityTemplateChildToActivityTemplateParent'
	}),
	projectParents: many(ProjectActivityParent, {
		relationName: 'ActivityTemplateParentToProjectActivityParent'
	})
}));

export const ActivityTemplateChildRelations = relations(ActivityTemplateChild, ({ one, many }) => ({
	parent: one(ActivityTemplateParent, {
		relationName: 'ActivityTemplateChildToActivityTemplateParent',
		fields: [ActivityTemplateChild.parentId],
		references: [ActivityTemplateParent.id]
	}),
	responsibleRole: one(PositionRole, {
		relationName: 'ActivityTemplateChildToPositionRole',
		fields: [ActivityTemplateChild.responsibleRoleId],
		references: [PositionRole.id]
	}),
	projectChildren: many(ProjectActivityChild, {
		relationName: 'ActivityTemplateChildToProjectActivityChild'
	})
}));

export const ProjectActivitySnapshotMetaRelations = relations(ProjectActivitySnapshotMeta, ({ one }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectActivitySnapshotMeta',
		fields: [ProjectActivitySnapshotMeta.projectId],
		references: [Project.id]
	}),
	templateSet: one(ActivityTemplateSet, {
		relationName: 'ActivityTemplateSetToProjectActivitySnapshotMeta',
		fields: [ProjectActivitySnapshotMeta.templateSetId],
		references: [ActivityTemplateSet.id]
	}),
	templateVersion: one(ActivityTemplateVersion, {
		relationName: 'ActivityTemplateVersionToProjectActivitySnapshotMeta',
		fields: [ProjectActivitySnapshotMeta.templateVersionId],
		references: [ActivityTemplateVersion.id]
	})
}));

export const ProjectActivityParentRelations = relations(ProjectActivityParent, ({ one, many }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectActivityParent',
		fields: [ProjectActivityParent.projectId],
		references: [Project.id]
	}),
	templateParent: one(ActivityTemplateParent, {
		relationName: 'ActivityTemplateParentToProjectActivityParent',
		fields: [ProjectActivityParent.templateParentId],
		references: [ActivityTemplateParent.id]
	}),
	closedBy: one(User, {
		relationName: 'ActivityParentCloser',
		fields: [ProjectActivityParent.closedById],
		references: [User.id]
	}),
	children: many(ProjectActivityChild, {
		relationName: 'ProjectActivityChildToProjectActivityParent'
	}),
	events: many(ActivityEvent, {
		relationName: 'ActivityEventToProjectActivityParent'
	})
}));

export const ProjectActivityChildRelations = relations(ProjectActivityChild, ({ one, many }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectActivityChild',
		fields: [ProjectActivityChild.projectId],
		references: [Project.id]
	}),
	parent: one(ProjectActivityParent, {
		relationName: 'ProjectActivityChildToProjectActivityParent',
		fields: [ProjectActivityChild.parentId],
		references: [ProjectActivityParent.id]
	}),
	templateChild: one(ActivityTemplateChild, {
		relationName: 'ActivityTemplateChildToProjectActivityChild',
		fields: [ProjectActivityChild.templateChildId],
		references: [ActivityTemplateChild.id]
	}),
	responsibleRole: one(PositionRole, {
		relationName: 'PositionRoleToProjectActivityChild',
		fields: [ProjectActivityChild.responsibleRoleId],
		references: [PositionRole.id]
	}),
	assignee: one(User, {
		relationName: 'ActivityChildAssignee',
		fields: [ProjectActivityChild.assigneeUserId],
		references: [User.id]
	}),
	returnedBy: one(User, {
		relationName: 'ActivityChildReturner',
		fields: [ProjectActivityChild.returnedById],
		references: [User.id]
	}),
	attachments: many(ActivityAttachment, {
		relationName: 'ActivityAttachmentToProjectActivityChild'
	}),
	notifications: many(Notification, {
		relationName: 'NotificationToProjectActivityChild'
	}),
	events: many(ActivityEvent, {
		relationName: 'ActivityEventToProjectActivityChild'
	})
}));

export const ActivityEventRelations = relations(ActivityEvent, ({ one }) => ({
	project: one(Project, {
		relationName: 'ActivityEventToProject',
		fields: [ActivityEvent.projectId],
		references: [Project.id]
	}),
	parent: one(ProjectActivityParent, {
		relationName: 'ActivityEventToProjectActivityParent',
		fields: [ActivityEvent.parentId],
		references: [ProjectActivityParent.id]
	}),
	child: one(ProjectActivityChild, {
		relationName: 'ActivityEventToProjectActivityChild',
		fields: [ActivityEvent.childId],
		references: [ProjectActivityChild.id]
	}),
	actor: one(User, {
		relationName: 'ActivityEventToUser',
		fields: [ActivityEvent.actorUserId],
		references: [User.id]
	})
}));

export const ActivityAttachmentRelations = relations(ActivityAttachment, ({ one }) => ({
	project: one(Project, {
		relationName: 'ActivityAttachmentToProject',
		fields: [ActivityAttachment.projectId],
		references: [Project.id]
	}),
	child: one(ProjectActivityChild, {
		relationName: 'ActivityAttachmentToProjectActivityChild',
		fields: [ActivityAttachment.childId],
		references: [ProjectActivityChild.id]
	}),
	uploadedBy: one(User, {
		relationName: 'ActivityAttachmentUploader',
		fields: [ActivityAttachment.uploadedById],
		references: [User.id]
	}),
	deletedBy: one(User, {
		relationName: 'ActivityAttachmentDeleter',
		fields: [ActivityAttachment.deletedById],
		references: [User.id]
	})
}));

export const NotificationRelations = relations(Notification, ({ one }) => ({
	recipient: one(User, {
		relationName: 'NotificationRecipient',
		fields: [Notification.recipientUserId],
		references: [User.id]
	}),
	project: one(Project, {
		relationName: 'NotificationToProject',
		fields: [Notification.projectId],
		references: [Project.id]
	}),
	child: one(ProjectActivityChild, {
		relationName: 'NotificationToProjectActivityChild',
		fields: [Notification.childId],
		references: [ProjectActivityChild.id]
	}),
	createdBy: one(User, {
		relationName: 'NotificationCreator',
		fields: [Notification.createdById],
		references: [User.id]
	})
}));

export const StageGateRecordRelations = relations(StageGateRecord, ({ one }) => ({
	project: one(Project, {
		relationName: 'ProjectToStageGateRecord',
		fields: [StageGateRecord.projectId],
		references: [Project.id]
	})
}));

export const ProjectTrialPlanNodeRelations = relations(ProjectTrialPlanNode, ({ one }) => ({
	project: one(Project, {
		relationName: 'ProjectToProjectTrialPlanNode',
		fields: [ProjectTrialPlanNode.projectId],
		references: [Project.id]
	})
}));

export const TaskRelations = relations(Task, ({ one, many }) => ({
	project: one(Project, {
		relationName: 'ProjectToTask',
		fields: [Task.projectId],
		references: [Project.id]
	}),
	stage: one(ProjectStage, {
		relationName: 'ProjectStageToTask',
		fields: [Task.stageId],
		references: [ProjectStage.id]
	}),
	assigneeMember: one(ProjectMember, {
		relationName: 'TaskAssignee',
		fields: [Task.assigneeMemberId],
		references: [ProjectMember.id]
	}),
	creator: one(User, {
		relationName: 'TaskCreator',
		fields: [Task.creatorId],
		references: [User.id]
	}),
	statusChanges: many(TaskStatusChange, {
		relationName: 'TaskToTaskStatusChange'
	})
}));

export const TaskStatusChangeRelations = relations(TaskStatusChange, ({ one }) => ({
	task: one(Task, {
		relationName: 'TaskToTaskStatusChange',
		fields: [TaskStatusChange.taskId],
		references: [Task.id]
	})
}));

export const ComponentConfigRelations = relations(ComponentConfig, ({ one, many }) => ({
	dependsOn: one(ComponentConfig, {
		relationName: 'ComponentDependency',
		fields: [ComponentConfig.dependsOnId],
		references: [ComponentConfig.id]
	}),
	dependedBy: many(ComponentConfig, {
		relationName: 'ComponentDependency'
	})
}));

export const ObservabilityEventRelations = relations(ObservabilityEvent, ({ one }) => ({
	user: one(User, {
		relationName: 'ObservabilityEventToUser',
		fields: [ObservabilityEvent.userId],
		references: [User.id]
	}),
	project: one(Project, {
		relationName: 'ObservabilityEventToProject',
		fields: [ObservabilityEvent.projectId],
		references: [Project.id]
	})
}));

export const AiResourceMigrationRunRelations = relations(AiResourceMigrationRun, ({ one, many }) => ({
	operator: one(User, {
		relationName: 'AiResourceMigrationOperator',
		fields: [AiResourceMigrationRun.operatorId],
		references: [User.id]
	}),
	items: many(AiResourceMigrationItem, {
		relationName: 'AiResourceMigrationItemToAiResourceMigrationRun'
	})
}));

export const AiResourceMigrationItemRelations = relations(AiResourceMigrationItem, ({ one }) => ({
	run: one(AiResourceMigrationRun, {
		relationName: 'AiResourceMigrationItemToAiResourceMigrationRun',
		fields: [AiResourceMigrationItem.runId],
		references: [AiResourceMigrationRun.id]
	})
}));

export const AiResourceRelations = relations(AiResource, ({ one, many }) => ({
	createdBy: one(User, {
		relationName: 'AiResourceCreator',
		fields: [AiResource.createdById],
		references: [User.id]
	}),
	owner: one(User, {
		relationName: 'AiResourceOwner',
		fields: [AiResource.ownerId],
		references: [User.id]
	}),
	reviewRequests: many(AiResourceReviewRequest, {
		relationName: 'AiResourceToAiResourceReviewRequest'
	}),
	updateLogs: many(AiResourceUpdateLog, {
		relationName: 'AiResourceToAiResourceUpdateLog'
	}),
	favorites: many(AiResourceFavorite, {
		relationName: 'AiResourceToAiResourceFavorite'
	}),
	likes: many(AiResourceLike, {
		relationName: 'AiResourceToAiResourceLike'
	}),
	comments: many(AiResourceComment, {
		relationName: 'AiResourceToAiResourceComment'
	})
}));

export const AiResourceReviewRequestRelations = relations(AiResourceReviewRequest, ({ one }) => ({
	requester: one(User, {
		relationName: 'AiResourceReviewRequester',
		fields: [AiResourceReviewRequest.requesterId],
		references: [User.id]
	}),
	reviewer: one(User, {
		relationName: 'AiResourceReviewReviewer',
		fields: [AiResourceReviewRequest.reviewerId],
		references: [User.id]
	}),
	resource: one(AiResource, {
		relationName: 'AiResourceToAiResourceReviewRequest',
		fields: [AiResourceReviewRequest.resourceId],
		references: [AiResource.id]
	})
}));

export const AiResourceUpdateLogRelations = relations(AiResourceUpdateLog, ({ one }) => ({
	resource: one(AiResource, {
		relationName: 'AiResourceToAiResourceUpdateLog',
		fields: [AiResourceUpdateLog.resourceId],
		references: [AiResource.id]
	}),
	actor: one(User, {
		relationName: 'AiResourceUpdateActor',
		fields: [AiResourceUpdateLog.actorId],
		references: [User.id]
	}),
	reviewer: one(User, {
		relationName: 'AiResourceUpdateReviewer',
		fields: [AiResourceUpdateLog.reviewerId],
		references: [User.id]
	})
}));

export const AiResourceFavoriteTagRelations = relations(AiResourceFavoriteTag, ({ one, many }) => ({
	user: one(User, {
		relationName: 'AiResourceFavoriteTagToUser',
		fields: [AiResourceFavoriteTag.userId],
		references: [User.id]
	}),
	favorites: many(AiResourceFavorite, {
		relationName: 'AiResourceFavoriteToAiResourceFavoriteTag'
	})
}));

export const AiResourceFavoriteRelations = relations(AiResourceFavorite, ({ one }) => ({
	user: one(User, {
		relationName: 'AiResourceFavoriteToUser',
		fields: [AiResourceFavorite.userId],
		references: [User.id]
	}),
	resource: one(AiResource, {
		relationName: 'AiResourceToAiResourceFavorite',
		fields: [AiResourceFavorite.resourceId],
		references: [AiResource.id]
	}),
	tag: one(AiResourceFavoriteTag, {
		relationName: 'AiResourceFavoriteToAiResourceFavoriteTag',
		fields: [AiResourceFavorite.tagId],
		references: [AiResourceFavoriteTag.id]
	})
}));

export const AiResourceLikeRelations = relations(AiResourceLike, ({ one }) => ({
	user: one(User, {
		relationName: 'AiResourceLikeToUser',
		fields: [AiResourceLike.userId],
		references: [User.id]
	}),
	resource: one(AiResource, {
		relationName: 'AiResourceToAiResourceLike',
		fields: [AiResourceLike.resourceId],
		references: [AiResource.id]
	})
}));

export const AiResourceCommentRelations = relations(AiResourceComment, ({ one }) => ({
	resource: one(AiResource, {
		relationName: 'AiResourceToAiResourceComment',
		fields: [AiResourceComment.resourceId],
		references: [AiResource.id]
	}),
	user: one(User, {
		relationName: 'AiResourceCommentToUser',
		fields: [AiResourceComment.userId],
		references: [User.id]
	})
}));

export const AiResourceMembershipRelations = relations(AiResourceMembership, ({ one, many }) => ({
	user: one(User, {
		relationName: 'AiResourceMembershipToUser',
		fields: [AiResourceMembership.userId],
		references: [User.id]
	}),
	updatedBy: one(User, {
		relationName: 'AiResourceMembershipUpdater',
		fields: [AiResourceMembership.updatedById],
		references: [User.id]
	}),
	audits: many(AiResourceRoleAudit, {
		relationName: 'AiResourceMembershipToAiResourceRoleAudit'
	})
}));

export const AiResourceRoleAuditRelations = relations(AiResourceRoleAudit, ({ one }) => ({
	membership: one(AiResourceMembership, {
		relationName: 'AiResourceMembershipToAiResourceRoleAudit',
		fields: [AiResourceRoleAudit.membershipId],
		references: [AiResourceMembership.id]
	}),
	subjectUser: one(User, {
		relationName: 'AiResourceRoleAuditSubject',
		fields: [AiResourceRoleAudit.subjectUserId],
		references: [User.id]
	}),
	actor: one(User, {
		relationName: 'AiResourceRoleAuditActor',
		fields: [AiResourceRoleAudit.actorId],
		references: [User.id]
	})
}));
