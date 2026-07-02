-- Create project-level trial plan nodes shared by all browsers/users.
CREATE TABLE "ProjectTrialPlanNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "plannedStartDate" DATETIME,
    "plannedDueDate" DATETIME,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectTrialPlanNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectTrialPlanNode_projectId_sortOrder_idx" ON "ProjectTrialPlanNode"("projectId", "sortOrder");
