-- Deploy readiness: align database with prisma/schema.prisma
-- Fixes 7 schema/migration drifts that block or weaken a fresh deploy.
-- Bug 1 fix: remove orphan PositionRole.code column (not in schema, NOT NULL blocks seed)
-- Bug 3 fix: create missing ProjectRole table
-- Bug 4 fix: add ProjectMember.assignedRole
-- Bug 5-6 fix: add Project.startDate + expectedEndDate
-- Bug 7 fix: enforce PositionRole.name uniqueness at DB level
-- Bug 8 cleanup: drop orphan PositionRole_code_key index

-- 1. Drop orphan PositionRole.code unique index and column
DROP INDEX IF EXISTS "PositionRole_code_key";
ALTER TABLE "PositionRole" DROP COLUMN "code";

-- 2. Enforce PositionRole.name uniqueness (matches @unique in schema)
CREATE UNIQUE INDEX IF NOT EXISTS "PositionRole_name_key" ON "PositionRole"("name");

-- 3. Create ProjectRole table (model exists in schema, zero migrations)
CREATE TABLE IF NOT EXISTS "ProjectRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRole_code_key" ON "ProjectRole"("code");
CREATE INDEX IF NOT EXISTS "ProjectRole_sortOrder_idx" ON "ProjectRole"("sortOrder");
CREATE INDEX IF NOT EXISTS "ProjectRole_isActive_idx" ON "ProjectRole"("isActive");

-- 4. Add ProjectMember.assignedRole (in schema, not in any migration)
ALTER TABLE "ProjectMember" ADD COLUMN "assignedRole" TEXT;

-- 5. Add Project.startDate + expectedEndDate (in schema, not in any migration)
ALTER TABLE "Project" ADD COLUMN "startDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "expectedEndDate" DATETIME;
