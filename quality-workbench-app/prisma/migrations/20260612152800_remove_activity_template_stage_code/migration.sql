DROP INDEX "ActivityTemplateStage_versionId_code_key";

ALTER TABLE "ActivityTemplateStage" DROP COLUMN "code";

CREATE UNIQUE INDEX "ActivityTemplateStage_versionId_name_key" ON "ActivityTemplateStage"("versionId", "name");
