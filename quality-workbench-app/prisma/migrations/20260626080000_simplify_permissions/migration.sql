-- Redesign: permissions enforced via ProjectMember.role (owner/member/observer)
-- Remove roleGroup grouping concept — roles are now flat

-- Drop NpqActionPermission table (28 rows)
DROP TABLE "NpqActionPermission";

-- Drop roleGroup column from PositionRole (12 rows)
DROP INDEX "PositionRole_roleGroup_idx";
ALTER TABLE "PositionRole" DROP COLUMN "roleGroup";

-- Drop roleGroup column from ActivityTemplate (828 rows)
DROP INDEX "ActivityTemplate_roleGroup_idx";
ALTER TABLE "ActivityTemplate" DROP COLUMN "roleGroup";

-- Drop roleGroup column from ActivityTemplateChild (3313 rows)
DROP INDEX "ActivityTemplateChild_roleGroup_idx";
ALTER TABLE "ActivityTemplateChild" DROP COLUMN "roleGroup";

-- Drop roleGroup column from ProjectActivityChild (1657 rows)
DROP INDEX "ProjectActivityChild_projectId_roleGroup_idx";
ALTER TABLE "ProjectActivityChild" DROP COLUMN "roleGroup";
CREATE INDEX "ProjectActivityChild_projectId_idx" ON "ProjectActivityChild"("projectId");
