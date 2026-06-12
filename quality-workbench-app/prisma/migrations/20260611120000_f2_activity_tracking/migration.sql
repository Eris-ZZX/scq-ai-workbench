-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL,
    "projectTaskName" TEXT NOT NULL,
    "thirdLevelPlan" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "roleGroup" TEXT NOT NULL,
    "deliverableName" TEXT,
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "sourceBatchId" TEXT NOT NULL DEFAULT 'quality-activity-template-20260611',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectActivityParent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
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
    CONSTRAINT "ProjectActivityParent_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectActivityChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "thirdLevelPlan" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "roleGroup" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "requiresDeliverable" BOOLEAN NOT NULL DEFAULT false,
    "deliverableName" TEXT,
    "deliverableUrl" TEXT,
    "completionNote" TEXT,
    "blockerNote" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "plannedDueDateOverride" DATETIME,
    "completedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectActivityChild_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivityChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectActivityParent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "childId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "actionType" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectActivityParent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProjectActivityChild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComponentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "policy" TEXT NOT NULL DEFAULT 'whitelist',
    "description" TEXT,
    "dependsOnId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComponentConfig_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "ComponentConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ComponentConfig" ("createdAt", "description", "enabled", "id", "name", "order", "path", "updatedAt") SELECT "createdAt", "description", "enabled", "id", "name", "order", "path", "updatedAt" FROM "ComponentConfig";
DROP TABLE "ComponentConfig";
ALTER TABLE "new_ComponentConfig" RENAME TO "ComponentConfig";
CREATE UNIQUE INDEX "ComponentConfig_name_key" ON "ComponentConfig"("name");
CREATE UNIQUE INDEX "ComponentConfig_path_key" ON "ComponentConfig"("path");
CREATE INDEX "ComponentConfig_enabled_idx" ON "ComponentConfig"("enabled");
CREATE INDEX "ComponentConfig_order_idx" ON "ComponentConfig"("order");
CREATE INDEX "ComponentConfig_dependsOnId_idx" ON "ComponentConfig"("dependsOnId");
CREATE TABLE "new_ObservabilityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ObservabilityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ObservabilityEvent" ("durationMs", "errorMessage", "errorStack", "eventType", "id", "method", "parentSpanId", "path", "projectId", "requestBody", "responseSummary", "spanId", "statusCode", "timestamp", "traceId", "userId") SELECT "durationMs", "errorMessage", "errorStack", "eventType", "id", "method", "parentSpanId", "path", "projectId", "requestBody", "responseSummary", "spanId", "statusCode", "timestamp", "traceId", "userId" FROM "ObservabilityEvent";
DROP TABLE "ObservabilityEvent";
ALTER TABLE "new_ObservabilityEvent" RENAME TO "ObservabilityEvent";
CREATE INDEX "ObservabilityEvent_traceId_timestamp_idx" ON "ObservabilityEvent"("traceId", "timestamp");
CREATE INDEX "ObservabilityEvent_eventType_idx" ON "ObservabilityEvent"("eventType");
CREATE INDEX "ObservabilityEvent_timestamp_idx" ON "ObservabilityEvent"("timestamp");
CREATE INDEX "ObservabilityEvent_userId_idx" ON "ObservabilityEvent"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ActivityTemplate_stage_sortOrder_idx" ON "ActivityTemplate"("stage", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityTemplate_ownerRole_idx" ON "ActivityTemplate"("ownerRole");

-- CreateIndex
CREATE INDEX "ActivityTemplate_roleGroup_idx" ON "ActivityTemplate"("roleGroup");

-- CreateIndex
CREATE INDEX "ActivityTemplate_isActive_idx" ON "ActivityTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_stage_projectTaskName_thirdLevelPlan_ownerRole_sourceBatchId_key" ON "ActivityTemplate"("stage", "projectTaskName", "thirdLevelPlan", "ownerRole", "sourceBatchId");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_projectId_stage_idx" ON "ProjectActivityParent"("projectId", "stage");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_projectId_status_idx" ON "ProjectActivityParent"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_hasBlocked_idx" ON "ProjectActivityParent"("hasBlocked");

-- CreateIndex
CREATE INDEX "ProjectActivityParent_hasOverdue_idx" ON "ProjectActivityParent"("hasOverdue");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivityParent_projectId_stage_projectTaskName_key" ON "ProjectActivityParent"("projectId", "stage", "projectTaskName");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_ownerRole_idx" ON "ProjectActivityChild"("projectId", "ownerRole");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_roleGroup_idx" ON "ProjectActivityChild"("projectId", "roleGroup");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_projectId_status_idx" ON "ProjectActivityChild"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_parentId_sortOrder_idx" ON "ProjectActivityChild"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectActivityChild_isBlocked_idx" ON "ProjectActivityChild"("isBlocked");

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
CREATE UNIQUE INDEX "ProjectStage_projectId_order_key" ON "ProjectStage"("projectId", "order");
