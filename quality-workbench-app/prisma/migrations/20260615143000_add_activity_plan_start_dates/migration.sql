ALTER TABLE "ActivityTemplateStage" ADD COLUMN "plannedStartOffsetDays" INTEGER;
ALTER TABLE "ActivityTemplateStage" ADD COLUMN "plannedDueOffsetDays" INTEGER;

ALTER TABLE "ActivityTemplateParent" ADD COLUMN "plannedStartOffsetDays" INTEGER;

ALTER TABLE "ProjectActivityParent" ADD COLUMN "plannedStartDate" DATETIME;

ALTER TABLE "StageGateRecord" ADD COLUMN "plannedStartDate" DATETIME;
ALTER TABLE "StageGateRecord" ADD COLUMN "plannedDueDate" DATETIME;
