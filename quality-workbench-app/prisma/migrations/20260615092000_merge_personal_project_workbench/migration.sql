UPDATE ComponentConfig
SET name = '个人项目工作台',
    path = '/workbench',
    "order" = 1,
    updatedAt = CURRENT_TIMESTAMP
WHERE id = 'cmp-workbench';

DELETE FROM ComponentConfig
WHERE id = 'cmp-project-workbench'
   OR path = '/project-workbench';

UPDATE ComponentConfig
SET "order" = CASE id
  WHEN 'cmp-npq-activities' THEN 2
  WHEN 'cmp-npq-activity-dashboard' THEN 3
  WHEN 'cmp-admin-projects' THEN 4
  WHEN 'cmp-admin-templates' THEN 5
  WHEN 'cmp-admin-positions' THEN 6
  WHEN 'cmp-admin-users' THEN 7
  WHEN 'cmp-admin-components' THEN 8
  WHEN 'cmp-admin-observability' THEN 9
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
