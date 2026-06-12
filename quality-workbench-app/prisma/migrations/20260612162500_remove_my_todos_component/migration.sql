UPDATE "ComponentConfig"
SET "dependsOnId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "dependsOnId" = 'cmp-npq-todos';

DELETE FROM "ComponentConfig"
WHERE "id" = 'cmp-npq-todos' OR "path" = '/flows/npq/todos';
