-- CreateTable
CREATE TABLE "PositionRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleGroup" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "positionRoleId" TEXT NOT NULL,
    "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPosition_positionRoleId_fkey" FOREIGN KEY ("positionRoleId") REFERENCES "PositionRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPositionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "positionRoleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointedById" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectPositionAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectPositionAssignment_positionRoleId_fkey" FOREIGN KEY ("positionRoleId") REFERENCES "PositionRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectPositionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityTemplateSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latestPublishedVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTemplateSet_latestPublishedVersionId_fkey" FOREIGN KEY ("latestPublishedVersionId") REFERENCES "ActivityTemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateSetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceVersionId" TEXT,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTemplateVersion_templateSetId_fkey" FOREIGN KEY ("templateSetId") REFERENCES "ActivityTemplateSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityTemplateStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTemplateStage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ActivityTemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityTemplateParent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "closureStandard" TEXT,
    "plannedOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTemplateParent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ActivityTemplateStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityTemplateChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerRoleName" TEXT NOT NULL,
    "roleGroup" TEXT NOT NULL,
    "responsibleRoleId" TEXT,
    "deliverableName" TEXT,
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTemplateChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ActivityTemplateParent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityTemplateChild_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "PositionRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectActivitySnapshotMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "templateSetId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "localAdjustmentCount" INTEGER NOT NULL DEFAULT 0,
    "notApplicableCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectActivitySnapshotMeta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivitySnapshotMeta_templateSetId_fkey" FOREIGN KEY ("templateSetId") REFERENCES "ActivityTemplateSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivitySnapshotMeta_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ActivityTemplateVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityAttachment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActivityAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "childId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdById" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NpqActionPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionKey" TEXT NOT NULL,
    "positionRoleId" TEXT NOT NULL,
    "canExecute" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'project',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NpqActionPermission_positionRoleId_fkey" FOREIGN KEY ("positionRoleId") REFERENCES "PositionRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageGateRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "passedAt" DATETIME,
    "passedById" TEXT,
    "conditionReleaseNote" TEXT,
    "blockerSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StageGateRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" DATETIME,
    "currentStage" TEXT NOT NULL DEFAULT 'TR1',
    "currentStageStartedAt" DATETIME,
    "stageGateStatus" TEXT NOT NULL DEFAULT 'active'
);
INSERT INTO "new_Project" ("completedAt", "createdAt", "description", "externalId", "externalSource", "id", "name", "status", "syncAt", "updatedAt") SELECT "completedAt", "createdAt", "description", "externalId", "externalSource", "id", "name", "status", "syncAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_currentStage_idx" ON "Project"("currentStage");
CREATE TABLE "new_ProjectActivityChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "templateChildId" TEXT,
    "thirdLevelPlan" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "roleGroup" TEXT NOT NULL,
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
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "returnReason" TEXT,
    "isManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "plannedDueDateOverride" DATETIME,
    "completedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectActivityChild_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectActivityParent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_templateChildId_fkey" FOREIGN KEY ("templateChildId") REFERENCES "ActivityTemplateChild" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "PositionRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectActivityChild" ("blockerNote", "completedAt", "completionNote", "createdAt", "deliverableName", "deliverableUrl", "id", "isBlocked", "ownerRole", "parentId", "plannedDueDateOverride", "projectId", "requiresDeliverable", "roleGroup", "sortOrder", "status", "thirdLevelPlan", "updatedAt") SELECT "blockerNote", "completedAt", "completionNote", "createdAt", "deliverableName", "deliverableUrl", "id", "isBlocked", "ownerRole", "parentId", "plannedDueDateOverride", "projectId", "requiresDeliverable", "roleGroup", "sortOrder", "status", "thirdLevelPlan", "updatedAt" FROM "ProjectActivityChild";
DROP TABLE "ProjectActivityChild";
ALTER TABLE "new_ProjectActivityChild" RENAME TO "ProjectActivityChild";
CREATE INDEX "ProjectActivityChild_projectId_ownerRole_idx" ON "ProjectActivityChild"("projectId", "ownerRole");
CREATE INDEX "ProjectActivityChild_projectId_roleGroup_idx" ON "ProjectActivityChild"("projectId", "roleGroup");
CREATE INDEX "ProjectActivityChild_projectId_status_idx" ON "ProjectActivityChild"("projectId", "status");
CREATE INDEX "ProjectActivityChild_projectId_assigneeUserId_idx" ON "ProjectActivityChild"("projectId", "assigneeUserId");
CREATE INDEX "ProjectActivityChild_responsibleRoleId_idx" ON "ProjectActivityChild"("responsibleRoleId");
CREATE INDEX "ProjectActivityChild_templateChildId_idx" ON "ProjectActivityChild"("templateChildId");
CREATE INDEX "ProjectActivityChild_parentId_sortOrder_idx" ON "ProjectActivityChild"("parentId", "sortOrder");
CREATE INDEX "ProjectActivityChild_isBlocked_idx" ON "ProjectActivityChild"("isBlocked");
CREATE INDEX "ProjectActivityChild_isNotApplicable_idx" ON "ProjectActivityChild"("isNotApplicable");
CREATE UNIQUE INDEX "ProjectActivityChild_parentId_thirdLevelPlan_ownerRole_key" ON "ProjectActivityChild"("parentId", "thirdLevelPlan", "ownerRole");
CREATE TABLE "new_ProjectActivityParent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "templateParentId" TEXT,
    "stage" TEXT NOT NULL,
    "projectTaskName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "plannedDueDate" DATETIME,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "hasBlocked" BOOLEAN NOT NULL DEFAULT false,
    "hasOverdue" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectActivityParent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityParent_templateParentId_fkey" FOREIGN KEY ("templateParentId") REFERENCES "ActivityTemplateParent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityParent_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectActivityParent" ("closedAt", "closedById", "createdAt", "hasBlocked", "hasOverdue", "id", "plannedDueDate", "progressPercent", "projectId", "projectTaskName", "sortOrder", "stage", "status", "updatedAt") SELECT "closedAt", "closedById", "createdAt", "hasBlocked", "hasOverdue", "id", "plannedDueDate", "progressPercent", "projectId", "projectTaskName", "sortOrder", "stage", "status", "updatedAt" FROM "ProjectActivityParent";
DROP TABLE "ProjectActivityParent";
ALTER TABLE "new_ProjectActivityParent" RENAME TO "ProjectActivityParent";
CREATE INDEX "ProjectActivityParent_projectId_stage_idx" ON "ProjectActivityParent"("projectId", "stage");
CREATE INDEX "ProjectActivityParent_projectId_status_idx" ON "ProjectActivityParent"("projectId", "status");
CREATE INDEX "ProjectActivityParent_templateParentId_idx" ON "ProjectActivityParent"("templateParentId");
CREATE INDEX "ProjectActivityParent_hasBlocked_idx" ON "ProjectActivityParent"("hasBlocked");
CREATE INDEX "ProjectActivityParent_hasOverdue_idx" ON "ProjectActivityParent"("hasOverdue");
CREATE UNIQUE INDEX "ProjectActivityParent_projectId_stage_projectTaskName_key" ON "ProjectActivityParent"("projectId", "stage", "projectTaskName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PositionRole_code_key" ON "PositionRole"("code");

-- CreateIndex
CREATE INDEX "PositionRole_roleGroup_idx" ON "PositionRole"("roleGroup");

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
CREATE UNIQUE INDEX "ActivityTemplateStage_versionId_code_key" ON "ActivityTemplateStage"("versionId", "code");

-- CreateIndex
CREATE INDEX "ActivityTemplateParent_stageId_sortOrder_idx" ON "ActivityTemplateParent"("stageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateParent_stageId_name_key" ON "ActivityTemplateParent"("stageId", "name");

-- CreateIndex
CREATE INDEX "ActivityTemplateChild_parentId_sortOrder_idx" ON "ActivityTemplateChild"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityTemplateChild_responsibleRoleId_idx" ON "ActivityTemplateChild"("responsibleRoleId");

-- CreateIndex
CREATE INDEX "ActivityTemplateChild_roleGroup_idx" ON "ActivityTemplateChild"("roleGroup");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateChild_parentId_title_ownerRoleName_key" ON "ActivityTemplateChild"("parentId", "title", "ownerRoleName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivitySnapshotMeta_projectId_key" ON "ProjectActivitySnapshotMeta"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivitySnapshotMeta_templateSetId_idx" ON "ProjectActivitySnapshotMeta"("templateSetId");

-- CreateIndex
CREATE INDEX "ProjectActivitySnapshotMeta_templateVersionId_idx" ON "ProjectActivitySnapshotMeta"("templateVersionId");

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
CREATE INDEX "NpqActionPermission_positionRoleId_idx" ON "NpqActionPermission"("positionRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "NpqActionPermission_actionKey_positionRoleId_key" ON "NpqActionPermission"("actionKey", "positionRoleId");

-- CreateIndex
CREATE INDEX "StageGateRecord_projectId_status_idx" ON "StageGateRecord"("projectId", "status");

-- CreateIndex
CREATE INDEX "StageGateRecord_stage_idx" ON "StageGateRecord"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "StageGateRecord_projectId_stage_key" ON "StageGateRecord"("projectId", "stage");
