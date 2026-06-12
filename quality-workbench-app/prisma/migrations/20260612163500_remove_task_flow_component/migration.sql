UPDATE "ComponentConfig"
SET "dependsOnId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "dependsOnId" = 'cmp-npq-tasks';

DELETE FROM "ComponentConfig"
WHERE "id" = 'cmp-npq-tasks' OR "path" = '/flows/npq/tasks';
