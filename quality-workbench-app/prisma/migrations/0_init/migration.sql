-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "currentStage" TEXT NOT NULL DEFAULT 'TR1',
    "currentStageStartedAt" TIMESTAMP(3),
    "stageGateStatus" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "assignedRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleName" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionRoleId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPositionAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "positionRoleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPositionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "blockedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latestPublishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplateSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateSetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateStage" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStartOffsetDays" INTEGER,
    "plannedDueOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplateStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateParent" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "closureStandard" TEXT,
    "plannedStartOffsetDays" INTEGER,
    "plannedOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplateParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateChild" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerRoleName" TEXT NOT NULL,
    "responsibleRoleId" TEXT,
    "deliverableName" TEXT,
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplateChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivitySnapshotMeta" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateSetId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "localAdjustmentCount" INTEGER NOT NULL DEFAULT 0,
    "notApplicableCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectActivitySnapshotMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "projectTaskName" TEXT NOT NULL,
    "thirdLevelPlan" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "deliverableName" TEXT,
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "sourceBatchId" TEXT NOT NULL DEFAULT 'quality-activity-template-20260611',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivityParent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateParentId" TEXT,
    "stage" TEXT NOT NULL,
    "projectTaskName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "plannedStartDate" TIMESTAMP(3),
    "plannedDueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "hasBlocked" BOOLEAN NOT NULL DEFAULT false,
    "hasOverdue" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectActivityParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivityChild" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "templateChildId" TEXT,
    "thirdLevelPlan" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "responsibleRoleId" TEXT,
    "assigneeUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "deliverableName" TEXT,
    "deliverableUrl" TEXT,
    "completionNote" TEXT,
    "blockerNote" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "notApplicableReason" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnReason" TEXT,
    "isManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "plannedDueDateOverride" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectActivityChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "childId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "actionType" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "childId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageGateRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plannedStartDate" TIMESTAMP(3),
    "plannedDueDate" TIMESTAMP(3),
    "passedAt" TIMESTAMP(3),
    "passedById" TEXT,
    "conditionReleaseNote" TEXT,
    "blockerSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageGateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTrialPlanNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3),
    "plannedDueDate" TIMESTAMP(3),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTrialPlanNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "assigneeMemberId" TEXT,
    "creatorId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatusChange" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "policy" TEXT NOT NULL DEFAULT 'whitelist',
    "description" TEXT,
    "dependsOnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservabilityEvent" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "spanId" TEXT,
    "parentSpanId" TEXT,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "method" TEXT,
    "userId" TEXT,
    "projectId" TEXT,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "requestBody" TEXT,
    "responseSummary" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_currentStage_idx" ON "Project"("currentStage");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRole_code_key" ON "ProjectRole"("code");

-- CreateIndex
CREATE INDEX "ProjectRole_sortOrder_idx" ON "ProjectRole"("sortOrder");

-- CreateIndex
CREATE INDEX "ProjectRole_isActive_idx" ON "ProjectRole"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PositionRole_name_key" ON "PositionRole"("name");

-- CreateIndex
CREATE INDEX "PositionRole_name_roleName_idx" ON "PositionRole"("name", "roleName");

-- CreateIndex
CREATE INDEX "PositionRole_isActive_sortOrder_idx" ON "PositionRole"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserPosition_userId_key" ON "UserPosition"("userId");

-- CreateIndex
CREATE INDEX "UserPosition_positionRoleId_idx" ON "UserPosition"("positionRoleId");

-- CreateIndex
CREATE INDEX "ProjectPositionAssignment_projectId_idx" ON "ProjectPositionAssignment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPositionAssignment_userId_idx" ON "ProjectPositionAssignment"("userId");

-- CreateIndex
CREATE INDEX "ProjectPositionAssignment_positionRoleId_idx" ON "ProjectPositionAssignment"("positionRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPositionAssignment_projectId_positionRoleId_key" ON "ProjectPositionAssignment"("projectId", "positionRoleId");

-- CreateIndex
CREATE INDEX "StageTemplate_order_idx" ON "StageTemplate"("order");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_order_idx" ON "ProjectStage"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_status_idx" ON "ProjectStage"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_order_key" ON "ProjectStage"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateSet_code_key" ON "ActivityTemplateSet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateSet_latestPublishedVersionId_key" ON "ActivityTemplateSet"("latestPublishedVersionId");

-- CreateIndex
CREATE INDEX "ActivityTemplateSet_isActive_idx" ON "ActivityTemplateSet"("isActive");

-- CreateIndex
CREATE INDEX "ActivityTemplateVersion_templateSetId_status_idx" ON "ActivityTemplateVersion"("templateSetId", "status");

-- CreateIndex
CREATE INDEX "ActivityTemplateVersion_status_idx" ON "ActivityTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateVersion_templateSetId_version_key" ON "ActivityTemplateVersion"("templateSetId", "version");

-- CreateIndex
CREATE INDEX "ActivityTemplateStage_versionId_sortOrder_idx" ON "ActivityTemplateStage"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateStage_versionId_name_key" ON "ActivityTemplateStage"("versionId", "name");

-- CreateIndex
CREATE INDEX "ActivityTemplateParent_stageId_sortOrder_idx" ON "ActivityTemplateParent"("stageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateParent_stageId_name_key" ON "ActivityTemplateParent"("stageId", "name");

-- CreateIndex
CREATE INDEX "ActivityTemplateChild_parentId_sortOrder_idx" ON "ActivityTemplateChild"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityTemplateChild_responsibleRoleId_idx" ON "ActivityTemplateChild"("responsibleRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateChild_parentId_title_ownerRoleName_key" ON "ActivityTemplateChild"("parentId", "title", "ownerRoleName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivitySnapshotMeta_projectId_key" ON "ProjectActivitySnapshotMeta"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivitySnapshotMeta_templateSetId_idx" ON "ProjectActivitySnapshotMeta"("templateSetId");

-- CreateIndex
CREATE INDEX "ProjectActivitySnapshotMeta_templateVersionId_idx" ON "ProjectActivitySnapshotMeta"("templateVersionId");

-- CreateIndex
CREATE INDEX "ActivityTemplate_stage_sortOrder_idx" ON "ActivityTemplate"("stage", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityTemplate_ownerRole_idx" ON "ActivityTemplate"("ownerRole");

-- CreateIndex
CREATE INDEX "ActivityTemplate_isActive_idx" ON "ActivityTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_stage_projectTaskName_thirdLevelPlan_owner_key" ON "ActivityTemplate"("stage", "projectTaskName", "thirdLevelPlan", "ownerRole", "sourceBatchId");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_projectId_stage_idx" ON "ProjectActivityParent"("projectId", "stage");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_projectId_status_idx" ON "ProjectActivityParent"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_templateParentId_idx" ON "ProjectActivityParent"("templateParentId");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_hasBlocked_idx" ON "ProjectActivityParent"("hasBlocked");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_hasOverdue_idx" ON "ProjectActivityParent"("hasOverdue");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivityParent_projectId_stage_projectTaskName_key" ON "ProjectActivityParent"("projectId", "stage", "projectTaskName");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_ownerRole_idx" ON "ProjectActivityChild"("projectId", "ownerRole");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_idx" ON "ProjectActivityChild"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_status_idx" ON "ProjectActivityChild"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_assigneeUserId_idx" ON "ProjectActivityChild"("projectId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_responsibleRoleId_idx" ON "ProjectActivityChild"("responsibleRoleId");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_templateChildId_idx" ON "ProjectActivityChild"("templateChildId");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_parentId_sortOrder_idx" ON "ProjectActivityChild"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_isBlocked_idx" ON "ProjectActivityChild"("isBlocked");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_isNotApplicable_idx" ON "ProjectActivityChild"("isNotApplicable");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivityChild_parentId_thirdLevelPlan_ownerRole_key" ON "ProjectActivityChild"("parentId", "thirdLevelPlan", "ownerRole");

-- CreateIndex
CREATE INDEX "ActivityEvent_projectId_createdAt_idx" ON "ActivityEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_parentId_createdAt_idx" ON "ActivityEvent"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_childId_createdAt_idx" ON "ActivityEvent"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorUserId_idx" ON "ActivityEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ActivityEvent_actionType_idx" ON "ActivityEvent"("actionType");

-- CreateIndex
CREATE INDEX "ActivityAttachment_projectId_createdAt_idx" ON "ActivityAttachment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityAttachment_childId_idx" ON "ActivityAttachment"("childId");

-- CreateIndex
CREATE INDEX "ActivityAttachment_uploadedById_idx" ON "ActivityAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "ActivityAttachment_deletedAt_idx" ON "ActivityAttachment"("deletedAt");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_status_createdAt_idx" ON "Notification"("recipientUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- CreateIndex
CREATE INDEX "Notification_childId_idx" ON "Notification"("childId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "StageGateRecord_projectId_status_idx" ON "StageGateRecord"("projectId", "status");

-- CreateIndex
CREATE INDEX "StageGateRecord_stage_idx" ON "StageGateRecord"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "StageGateRecord_projectId_stage_key" ON "StageGateRecord"("projectId", "stage");

-- CreateIndex
CREATE INDEX "ProjectTrialPlanNode_projectId_sortOrder_idx" ON "ProjectTrialPlanNode"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_assigneeMemberId_status_idx" ON "Task"("assigneeMemberId", "status");

-- CreateIndex
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");

-- CreateIndex
CREATE INDEX "TaskStatusChange_taskId_createdAt_idx" ON "TaskStatusChange"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskStatusChange_changedBy_idx" ON "TaskStatusChange"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentConfig_name_key" ON "ComponentConfig"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentConfig_path_key" ON "ComponentConfig"("path");

-- CreateIndex
CREATE INDEX "ComponentConfig_enabled_idx" ON "ComponentConfig"("enabled");

-- CreateIndex
CREATE INDEX "ComponentConfig_order_idx" ON "ComponentConfig"("order");

-- CreateIndex
CREATE INDEX "ComponentConfig_dependsOnId_idx" ON "ComponentConfig"("dependsOnId");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_traceId_timestamp_idx" ON "ObservabilityEvent"("traceId", "timestamp");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_eventType_idx" ON "ObservabilityEvent"("eventType");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_timestamp_idx" ON "ObservabilityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_userId_idx" ON "ObservabilityEvent"("userId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPosition" ADD CONSTRAINT "UserPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPosition" ADD CONSTRAINT "UserPosition_positionRoleId_fkey" FOREIGN KEY ("positionRoleId") REFERENCES "PositionRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPositionAssignment" ADD CONSTRAINT "ProjectPositionAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPositionAssignment" ADD CONSTRAINT "ProjectPositionAssignment_positionRoleId_fkey" FOREIGN KEY ("positionRoleId") REFERENCES "PositionRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPositionAssignment" ADD CONSTRAINT "ProjectPositionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateSet" ADD CONSTRAINT "ActivityTemplateSet_latestPublishedVersionId_fkey" FOREIGN KEY ("latestPublishedVersionId") REFERENCES "ActivityTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateVersion" ADD CONSTRAINT "ActivityTemplateVersion_templateSetId_fkey" FOREIGN KEY ("templateSetId") REFERENCES "ActivityTemplateSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateStage" ADD CONSTRAINT "ActivityTemplateStage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ActivityTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateParent" ADD CONSTRAINT "ActivityTemplateParent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ActivityTemplateStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateChild" ADD CONSTRAINT "ActivityTemplateChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ActivityTemplateParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateChild" ADD CONSTRAINT "ActivityTemplateChild_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "PositionRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivitySnapshotMeta" ADD CONSTRAINT "ProjectActivitySnapshotMeta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivitySnapshotMeta" ADD CONSTRAINT "ProjectActivitySnapshotMeta_templateSetId_fkey" FOREIGN KEY ("templateSetId") REFERENCES "ActivityTemplateSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivitySnapshotMeta" ADD CONSTRAINT "ProjectActivitySnapshotMeta_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ActivityTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityParent" ADD CONSTRAINT "ProjectActivityParent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityParent" ADD CONSTRAINT "ProjectActivityParent_templateParentId_fkey" FOREIGN KEY ("templateParentId") REFERENCES "ActivityTemplateParent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityParent" ADD CONSTRAINT "ProjectActivityParent_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectActivityParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_templateChildId_fkey" FOREIGN KEY ("templateChildId") REFERENCES "ActivityTemplateChild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "PositionRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityChild" ADD CONSTRAINT "ProjectActivityChild_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectActivityParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageGateRecord" ADD CONSTRAINT "StageGateRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTrialPlanNode" ADD CONSTRAINT "ProjectTrialPlanNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeMemberId_fkey" FOREIGN KEY ("assigneeMemberId") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentConfig" ADD CONSTRAINT "ComponentConfig_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "ComponentConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityEvent" ADD CONSTRAINT "ObservabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityEvent" ADD CONSTRAINT "ObservabilityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

