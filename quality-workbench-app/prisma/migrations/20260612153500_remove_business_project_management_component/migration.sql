UPDATE "ComponentConfig"
SET "dependsOnId" = NULL
WHERE "dependsOnId" = 'cmp-npq-projects';

DELETE FROM "ComponentConfig"
WHERE "id" = 'cmp-npq-projects' OR "path" = '/flows/npq/projects';
