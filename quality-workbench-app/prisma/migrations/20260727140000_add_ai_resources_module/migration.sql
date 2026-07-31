-- AlterTable
CREATE UNIQUE INDEX "User_externalSource_externalId_key" ON "User"("externalSource", "externalId");

-- CreateTable
CREATE TABLE "AiResourceModuleSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AiResourceMigrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "reportPath" TEXT,
    "operatorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    CONSTRAINT "AiResourceMigrationRun_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceMigrationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" TEXT,
    "afterHash" TEXT,
    CONSTRAINT "AiResourceMigrationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiResourceMigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "ownerName" TEXT NOT NULL,
    "visibilityScope" TEXT NOT NULL DEFAULT 'ALL',
    "visibleDeptIds" TEXT NOT NULL DEFAULT '',
    "visibleUserIds" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "archivedFromStatus" TEXT,
    "resourceUrl" TEXT,
    "content" TEXT NOT NULL,
    "attachments" TEXT,
    "extension" TEXT,
    "extractedText" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "AiResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceReviewRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resourceId" TEXT,
    "proposedData" TEXT NOT NULL,
    "updateSummary" TEXT NOT NULL,
    "changedFields" TEXT NOT NULL DEFAULT '',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    CONSTRAINT "AiResourceReviewRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiResourceReviewRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiResourceReviewRequest_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AiResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceUpdateLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" TEXT,
    "resourceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewId" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "updateSummary" TEXT NOT NULL,
    "changedFields" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiResourceUpdateLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AiResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiResourceUpdateLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiResourceUpdateLog_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" TEXT,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiResourceFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiResourceFavorite_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AiResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiResourceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiResourceMembership_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResourceRoleAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT,
    "subjectUserId" TEXT,
    "subjectUserIdSnapshot" TEXT NOT NULL,
    "subjectUsernameSnapshot" TEXT NOT NULL,
    "actorId" TEXT,
    "fromRole" TEXT,
    "toRole" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiResourceRoleAudit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "AiResourceMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiResourceRoleAudit_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiResourceRoleAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiResourceMigrationRun_status_idx" ON "AiResourceMigrationRun"("status");
CREATE INDEX "AiResourceMigrationRun_startedAt_idx" ON "AiResourceMigrationRun"("startedAt");
CREATE UNIQUE INDEX "AiResourceMigrationItem_runId_entityType_legacyId_key" ON "AiResourceMigrationItem"("runId", "entityType", "legacyId");
CREATE INDEX "AiResourceMigrationItem_runId_idx" ON "AiResourceMigrationItem"("runId");
CREATE INDEX "AiResourceMigrationItem_targetId_idx" ON "AiResourceMigrationItem"("targetId");
CREATE UNIQUE INDEX "AiResource_legacyId_key" ON "AiResource"("legacyId");
CREATE INDEX "AiResource_type_idx" ON "AiResource"("type");
CREATE INDEX "AiResource_status_idx" ON "AiResource"("status");
CREATE INDEX "AiResource_createdById_idx" ON "AiResource"("createdById");
CREATE INDEX "AiResource_updatedAt_idx" ON "AiResource"("updatedAt");
CREATE UNIQUE INDEX "AiResourceReviewRequest_legacyId_key" ON "AiResourceReviewRequest"("legacyId");
CREATE INDEX "AiResourceReviewRequest_status_idx" ON "AiResourceReviewRequest"("status");
CREATE INDEX "AiResourceReviewRequest_requesterId_idx" ON "AiResourceReviewRequest"("requesterId");
CREATE INDEX "AiResourceReviewRequest_resourceId_idx" ON "AiResourceReviewRequest"("resourceId");
CREATE UNIQUE INDEX "AiResourceUpdateLog_legacyId_key" ON "AiResourceUpdateLog"("legacyId");
CREATE INDEX "AiResourceUpdateLog_resourceId_idx" ON "AiResourceUpdateLog"("resourceId");
CREATE INDEX "AiResourceUpdateLog_createdAt_idx" ON "AiResourceUpdateLog"("createdAt");
CREATE UNIQUE INDEX "AiResourceFavorite_legacyId_key" ON "AiResourceFavorite"("legacyId");
CREATE UNIQUE INDEX "AiResourceFavorite_userId_resourceId_key" ON "AiResourceFavorite"("userId", "resourceId");
CREATE INDEX "AiResourceFavorite_userId_idx" ON "AiResourceFavorite"("userId");
CREATE INDEX "AiResourceFavorite_resourceId_idx" ON "AiResourceFavorite"("resourceId");
CREATE UNIQUE INDEX "AiResourceMembership_userId_key" ON "AiResourceMembership"("userId");
CREATE INDEX "AiResourceMembership_role_idx" ON "AiResourceMembership"("role");
CREATE INDEX "AiResourceRoleAudit_subjectUserId_idx" ON "AiResourceRoleAudit"("subjectUserId");
CREATE INDEX "AiResourceRoleAudit_createdAt_idx" ON "AiResourceRoleAudit"("createdAt");

-- Seed default module settings row
INSERT INTO "AiResourceModuleSettings" ("id", "maintenanceMode", "updatedAt")
VALUES ('default', false, CURRENT_TIMESTAMP);
