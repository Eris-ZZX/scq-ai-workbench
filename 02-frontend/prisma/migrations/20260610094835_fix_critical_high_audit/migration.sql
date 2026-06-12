/*
  Warnings:

  - You are about to drop the column `assigneeId` on the `Task` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ObservabilityEvent_traceId_idx";

-- DropIndex
DROP INDEX "ProjectStage_order_idx";

-- DropIndex
DROP INDEX "ProjectStage_projectId_idx";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "completedAt" DATETIME;

-- AlterTable
ALTER TABLE "ProjectStage" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "ProjectStage" ADD COLUMN "completedAt" DATETIME;

-- CreateTable
CREATE TABLE "TaskStatusChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskStatusChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ComponentConfig" ("createdAt", "description", "enabled", "id", "name", "path", "updatedAt") SELECT "createdAt", "description", "enabled", "id", "name", "path", "updatedAt" FROM "ComponentConfig";
DROP TABLE "ComponentConfig";
ALTER TABLE "new_ComponentConfig" RENAME TO "ComponentConfig";
CREATE UNIQUE INDEX "ComponentConfig_name_key" ON "ComponentConfig"("name");
CREATE UNIQUE INDEX "ComponentConfig_path_key" ON "ComponentConfig"("path");
CREATE INDEX "ComponentConfig_enabled_idx" ON "ComponentConfig"("enabled");
CREATE INDEX "ComponentConfig_order_idx" ON "ComponentConfig"("order");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "assigneeMemberId" TEXT,
    "creatorId" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" DATETIME,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeMemberId_fkey" FOREIGN KEY ("assigneeMemberId") REFERENCES "ProjectMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "creatorId", "description", "externalId", "externalSource", "id", "priority", "projectId", "stageId", "status", "syncAt", "title", "updatedAt") SELECT "createdAt", "creatorId", "description", "externalId", "externalSource", "id", "priority", "projectId", "stageId", "status", "syncAt", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_assigneeMemberId_status_idx" ON "Task"("assigneeMemberId", "status");
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "syncAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "displayName", "email", "externalId", "externalSource", "id", "passwordHash", "role", "syncAt", "updatedAt", "username") SELECT "createdAt", "displayName", "email", "externalId", "externalSource", "id", "passwordHash", "role", "syncAt", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskStatusChange_taskId_createdAt_idx" ON "TaskStatusChange"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskStatusChange_changedBy_idx" ON "TaskStatusChange"("changedBy");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_traceId_timestamp_idx" ON "ObservabilityEvent"("traceId", "timestamp");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_order_idx" ON "ProjectStage"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_status_idx" ON "ProjectStage"("projectId", "status");
