ALTER TABLE "PositionRole" ADD COLUMN "roleName" TEXT;

UPDATE "PositionRole"
SET "roleName" = "name"
WHERE "roleName" IS NULL OR trim("roleName") = '';

CREATE INDEX "PositionRole_name_roleName_idx" ON "PositionRole"("name", "roleName");
