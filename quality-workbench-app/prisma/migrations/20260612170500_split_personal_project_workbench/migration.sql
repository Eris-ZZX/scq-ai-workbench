UPDATE "ComponentConfig"
SET name = '个人工作台',
    path = '/workbench',
    "order" = 1,
    updatedAt = CURRENT_TIMESTAMP
WHERE id = 'cmp-workbench';

INSERT INTO "ComponentConfig" (id, name, path, enabled, "order", createdAt, updatedAt)
VALUES ('cmp-project-workbench', '项目工作台', '/project-workbench', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  path = excluded.path,
  enabled = 1,
  "order" = excluded."order",
  updatedAt = CURRENT_TIMESTAMP;

UPDATE "ComponentConfig"
SET "order" = CASE id
  WHEN 'cmp-npq-activities' THEN 3
  WHEN 'cmp-npq-activity-dashboard' THEN 4
  WHEN 'cmp-admin-projects' THEN 5
  WHEN 'cmp-admin-templates' THEN 6
  WHEN 'cmp-admin-positions' THEN 7
  WHEN 'cmp-admin-users' THEN 8
  WHEN 'cmp-admin-components' THEN 9
  WHEN 'cmp-admin-observability' THEN 10
  ELSE "order"
END,
updatedAt = CURRENT_TIMESTAMP
WHERE id IN (
  'cmp-npq-activities',
  'cmp-npq-activity-dashboard',
  'cmp-admin-projects',
  'cmp-admin-templates',
  'cmp-admin-positions',
  'cmp-admin-users',
  'cmp-admin-components',
  'cmp-admin-observability'
);
