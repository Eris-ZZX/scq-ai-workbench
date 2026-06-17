import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.resolve(process.cwd(), 'dev.db');
const db = createClient({ url: `file:${dbPath}` });
const templatePath = path.resolve(process.cwd(), 'prisma', 'quality-activity-template.json');
const TEST_PASSWORD_HASH = '$2b$10$zvMa9qFDxYK1MsTOaKbR6e6Kl6rRhV7L1lY6Zz0zxbDL17yWzCZK6';

const positionRoleSeeds = [
  ['pos-npq', 'NPQ', 'NPQ', 'NPQ', 'NPQ', 'New Product Quality owner', 1],
  ['pos-pqe', 'PQE', 'PQE', 'PQE', 'PQE', 'Process Quality Engineering', 2],
  ['pos-sqe', 'SQE', 'SQE', 'SQE-塑胶', 'SQE', 'Supplier Quality Engineering - plastic', 3],
  ['pos-sqe-metal', 'SQE-METAL', 'SQE', 'SQE-五金', 'SQE', 'Supplier Quality Engineering - metal', 4],
  ['pos-sqe-smt', 'SQE-SMT', 'SQE', 'SQE-SMT代表', 'SQE', 'Supplier Quality Engineering - SMT', 5],
  ['pos-sqe-packaging', 'SQE-PACKAGING', 'SQE', 'SQE-包材', 'SQE', 'Supplier Quality Engineering - packaging', 6],
  ['pos-sqe-custom-electronics', 'SQE-CUSTOM-ELECTRONICS', 'SQE', 'SQE-定制电子代表', 'SQE', 'Supplier Quality Engineering - custom electronics', 7],
  ['pos-sqe-silicone', 'SQE-SILICONE', 'SQE', 'SQE-硅胶', 'SQE', 'Supplier Quality Engineering - silicone', 8],
  ['pos-fae', 'FAE', 'FAE', 'FAE', 'FAE', 'Field Application Engineering', 9],
  ['pos-ram', 'RAM', 'RAM', 'RAM', 'RAM', 'Reliability and Maintainability', 10],
  ['pos-qcm', 'QCM', 'QCM', 'QCM', 'QCM', 'Quality Control Management', 11],
  ['pos-manager', 'MANAGER', '管理者', '管理者', 'MANAGER', 'Business read-only manager', 12],
] as const;

function positionRoleId(roleGroup: string) {
  return `pos-${roleGroup.trim().toLowerCase()}`;
}

function responsiblePositionRoleId(ownerRole: string, roleGroup: string) {
  const exact: Record<string, string> = {
    'SQE-塑胶': 'pos-sqe',
    'SQE-五金': 'pos-sqe-metal',
    'SQE-SMT代表': 'pos-sqe-smt',
    'SQE-包材': 'pos-sqe-packaging',
    'SQE-定制电子代表': 'pos-sqe-custom-electronics',
    'SQE-硅胶': 'pos-sqe-silicone',
  };
  return exact[ownerRole.trim()] ?? positionRoleId(roleGroup);
}

type QualityActivityTemplateRow = {
  stage: string;
  projectTaskName: string;
  thirdLevelPlan: string;
  ownerRole: string;
  roleGroup: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  sortOrder: number;
};

// 🔧 M16: SQLITE_BUSY 重试包装器（最多重试 3 次，指数退避）
async function executeWithRetry(
  sql: string,
  args: unknown[],
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.execute({ sql, args });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < maxRetries && msg.includes('SQLITE_BUSY')) {
        const delay = Math.min(100 * 2 ** attempt, 1000);
        console.log(`  ⚠ SQLITE_BUSY, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  // Unreachable — maxRetries must be >= 1
  throw new Error('maxRetries must be >= 1');
}

async function main() {
  console.log('🌱 Seeding database...');
  console.log(`   DB: ${dbPath}\n`);

  // 🔧 H9: 用 ON CONFLICT DO UPDATE 代替 INSERT OR REPLACE
  //       避免 createdAt 被重置，避免触发级联删除

  // ── TR1→TR6 默认阶段模板 ──
  const stages = [
    ['seed-tr1', 'TR1 概念评审', 1],
    ['seed-tr2', 'TR2 方案评审', 2],
    ['seed-tr3', 'TR3 样机评审', 3],
    ['seed-tr4', 'TR4 试产评审', 4],
    ['seed-tr5', 'TR5 量产准入', 5],
    ['seed-tr6', 'TR6 项目结项', 6],
  ] as const;

  for (const [id, name, order] of stages) {
    await executeWithRetry(
      `INSERT INTO StageTemplate (id, name, "order", isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         "order"=excluded."order",
         updatedAt=datetime('now')`,
      [id, name, order],
    );
  }
  console.log('  ✓ Stage templates: TR1→TR6');

  // ── 预注册 MVP 功能组件 ──
  for (const [id, code, name, roleName, roleGroup, description, sortOrder] of positionRoleSeeds) {
    await executeWithRetry(
      `INSERT INTO PositionRole (id, code, name, roleName, roleGroup, description, isActive, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
       ON CONFLICT(code) DO UPDATE SET
         name=excluded.name,
         roleName=excluded.roleName,
         roleGroup=excluded.roleGroup,
         description=excluded.description,
         isActive=1,
         sortOrder=excluded.sortOrder,
         updatedAt=datetime('now')`,
      [id, code, name, roleName, roleGroup, description, sortOrder],
    );
  }
  console.log(`  F3 position roles: ${positionRoleSeeds.length} seeded`);

  const components = [
    ['cmp-workbench', '个人项目工作台', '/workbench', 1],
    ['cmp-npq-activities', '批量修改', '/flows/npq/activities', 2],
    ['cmp-npq-activity-dashboard', '活动管理看板', '/flows/npq/activity-dashboard', 3],
    ['cmp-admin-projects', '项目管理', '/admin/projects', 4],
    ['cmp-admin-templates', '模板中心', '/admin/templates', 5],
    ['cmp-admin-positions', '岗位角色', '/admin/positions', 6],
    ['cmp-admin-users', '用户管理', '/admin/users', 7],
    ['cmp-admin-components', '功能组件管理', '/admin/components', 8],
    ['cmp-admin-observability', '运行日志', '/admin/observability', 9],
  ] as const;

  for (const [id, name, cp, order] of components) {
    await executeWithRetry(
      `INSERT INTO ComponentConfig (id, name, path, enabled, "order", createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         path=excluded.path,
         "order"=excluded."order",
         updatedAt=datetime('now')`,
      [id, name, cp, order],
    );
  }
  await executeWithRetry(
    `UPDATE ComponentConfig
     SET dependsOnId = NULL, updatedAt = datetime('now')
     WHERE dependsOnId = 'cmp-npq-projects'`,
  );
  await executeWithRetry(
    `DELETE FROM ComponentConfig
     WHERE id IN ('cmp-npq-projects', 'cmp-npq-todos', 'cmp-npq-tasks')
        OR path IN ('/flows/npq/projects', '/flows/npq/todos', '/flows/npq/tasks')`,
    [],
  );
  await executeWithRetry(
    `DELETE FROM ComponentConfig
     WHERE id = 'cmp-project-workbench'
        OR path = '/project-workbench'`,
    [],
  );
  console.log(`  ✓ Component configs: ${components.length} registered (with F3 positions)`);

  // ── 设置组件依赖关系 ──
  const deps = [
    ['cmp-npq-activity-dashboard', 'cmp-npq-activities'], // 管理看板依赖活动跟踪
    ['cmp-admin-users', 'cmp-admin-positions'], // 用户岗位绑定依赖岗位字典
    ['cmp-admin-components', 'cmp-admin-templates'], // 组件管理依赖模板配置
  ];

  for (const [childId, parentId] of deps) {
    await executeWithRetry(
      `UPDATE ComponentConfig SET dependsOnId = ? WHERE id = ?`,
      [parentId, childId],
    );
  }
  console.log('  ✓ Component dependencies: tasks→projects, activities→projects, dashboard→activities');

  // ── F2 质量活动模板库 ──
  const activityTemplates = JSON.parse(
    fs.readFileSync(templatePath, 'utf8'),
  ) as QualityActivityTemplateRow[];

  for (const row of activityTemplates) {
    await executeWithRetry(
      `INSERT INTO ActivityTemplate
         (id, stage, projectTaskName, thirdLevelPlan, ownerRole, roleGroup,
          deliverableName, requiresDeliverable, sourceBatchId, sortOrder,
          isActive, createdAt, updatedAt)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, 'quality-activity-template-20260611', ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(stage, projectTaskName, thirdLevelPlan, ownerRole, sourceBatchId) DO UPDATE SET
         roleGroup=excluded.roleGroup,
         deliverableName=excluded.deliverableName,
         requiresDeliverable=excluded.requiresDeliverable,
         sortOrder=excluded.sortOrder,
         isActive=1,
         updatedAt=datetime('now')`,
      [
        `qat-${row.sortOrder}`,
        row.stage,
        row.projectTaskName,
        row.thirdLevelPlan,
        row.ownerRole,
        row.roleGroup,
        row.deliverableName,
        row.requiresDeliverable ? 1 : 0,
        row.sortOrder,
      ],
    );
  }
  console.log(`  ✓ Activity templates: ${activityTemplates.length} imported`);
  await seedStructuredActivityTemplate(activityTemplates);
  console.log('  F3 structured activity template: default v1 published');

  // ── F2 示例项目活动实例 ──
  const existingAdmin = await executeWithRetry('SELECT id FROM User WHERE username = ? LIMIT 1', ['admin']);
  const adminUserId = String(existingAdmin.rows[0]?.id ?? 'seed-admin');
  if (existingAdmin.rows[0]?.id) {
    await executeWithRetry(
      `UPDATE User
       SET passwordHash=?, role='admin', status='active', updatedAt=datetime('now')
       WHERE id=?`,
      [TEST_PASSWORD_HASH, adminUserId],
    );
  } else {
    await executeWithRetry(
      `INSERT INTO User (id, username, passwordHash, email, role, status, createdAt, updatedAt)
       VALUES (?, 'admin', ?, 'admin@example.com', 'admin', 'active', datetime('now'), datetime('now'))`,
      [adminUserId, TEST_PASSWORD_HASH],
    );
  }
  await executeWithRetry(
    `INSERT INTO Project (id, name, description, status, createdAt, updatedAt)
     VALUES ('seed-f2-project', 'F2 新产品导入活动样例项目', '由质量活动模板库生成的 TR1-TR6 全阶段活动实例', 'active', datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       description=excluded.description,
       status='active',
       updatedAt=datetime('now')`,
    [],
  );
  await executeWithRetry(
    `INSERT INTO ProjectMember (id, projectId, userId, role, createdAt)
     VALUES ('seed-f2-member-admin', 'seed-f2-project', ?, 'owner', datetime('now'))
     ON CONFLICT(projectId, userId) DO UPDATE SET role='owner'`,
    [adminUserId],
  );
  await executeWithRetry(
    `INSERT INTO UserPosition (id, userId, positionRoleId, effectiveAt, createdAt, updatedAt)
     VALUES ('seed-admin-position', ?, 'pos-npq', datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(userId) DO UPDATE SET
       positionRoleId='pos-npq',
       updatedAt=datetime('now')`,
    [adminUserId],
  );

  const fixedUsers = [
    ['seed-user-npq', 'npq', 'npq@example.com', 'pos-npq', 'owner'],
    ['seed-user-npq2', 'NPQ2', 'npq2@example.com', 'pos-npq', 'member'],
    ['seed-user-pqe', 'pqe', 'pqe@example.com', 'pos-pqe', 'member'],
    ['seed-user-sqe', 'sqe', 'sqe@example.com', 'pos-sqe', 'member'],
    ['seed-user-fae', 'fae', 'fae@example.com', 'pos-fae', 'member'],
    ['seed-user-ram', 'ram', 'ram@example.com', 'pos-ram', 'member'],
    ['seed-user-qcm', 'qcm', 'qcm@example.com', 'pos-qcm', 'member'],
    ['seed-user-manager', 'manager', 'manager@example.com', 'pos-manager', 'observer'],
  ] as const;
  const seedUserIds: Record<string, string> = { admin: adminUserId };

  for (const [seedId, username, email, positionRoleId, projectRole] of fixedUsers) {
    const existing = await executeWithRetry('SELECT id FROM User WHERE username = ? LIMIT 1', [username]);
    const userId = String(existing.rows[0]?.id ?? seedId);
    await executeWithRetry(
      `INSERT INTO User (id, username, passwordHash, email, role, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'user', 'active', datetime('now'), datetime('now'))
       ON CONFLICT(username) DO UPDATE SET
         passwordHash=excluded.passwordHash,
         role='user',
         status='active',
         updatedAt=datetime('now')`,
      [userId, username, TEST_PASSWORD_HASH, email],
    );
    seedUserIds[username] = userId;
    await executeWithRetry(
      `INSERT INTO UserPosition (id, userId, positionRoleId, effectiveAt, createdAt, updatedAt)
       VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
       ON CONFLICT(userId) DO UPDATE SET
         positionRoleId=excluded.positionRoleId,
         updatedAt=datetime('now')`,
      [`seed-${username}-position`, userId, positionRoleId],
    );
    await executeWithRetry(
      `INSERT INTO ProjectMember (id, projectId, userId, role, createdAt)
       VALUES (?, 'seed-f2-project', ?, ?, datetime('now'))
       ON CONFLICT(projectId, userId) DO UPDATE SET role=excluded.role`,
      [`seed-f2-member-${username}`, userId, projectRole],
    );
  }

  await executeWithRetry(
    `INSERT INTO ProjectPositionAssignment
       (id, projectId, positionRoleId, userId, appointedById, note, createdAt, updatedAt)
     VALUES ('seed-f2-project-npq', 'seed-f2-project', 'pos-npq', ?, ?, 'Seed NPQ owner', datetime('now'), datetime('now'))
     ON CONFLICT(projectId, positionRoleId) DO UPDATE SET
       userId=excluded.userId,
       appointedById=excluded.appointedById,
       note=excluded.note,
       updatedAt=datetime('now')`,
    [seedUserIds.npq, adminUserId],
  );
  const assignmentSeeds = [
    ['pqe', 'pos-pqe', 'Seed PQE owner'],
    ['sqe', 'pos-sqe', 'Seed SQE owner'],
    ['fae', 'pos-fae', 'Seed FAE owner'],
    ['ram', 'pos-ram', 'Seed RAM owner'],
    ['qcm', 'pos-qcm', 'Seed QCM owner'],
  ] as const;
  for (const [username, positionRoleId, note] of assignmentSeeds) {
    await executeWithRetry(
      `INSERT INTO ProjectPositionAssignment
         (id, projectId, positionRoleId, userId, appointedById, note, createdAt, updatedAt)
       VALUES (?, 'seed-f2-project', ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(projectId, positionRoleId) DO UPDATE SET
         userId=excluded.userId,
         appointedById=excluded.appointedById,
         note=excluded.note,
         updatedAt=datetime('now')`,
      [`seed-f2-project-${username}`, positionRoleId, seedUserIds[username], adminUserId, note],
    );
  }
  await executeWithRetry(
    `INSERT INTO ProjectActivitySnapshotMeta
       (id, projectId, templateSetId, templateVersionId, generatedAt, generatedById, localAdjustmentCount, notApplicableCount, updatedAt)
     VALUES ('seed-f2-project-template-snapshot', 'seed-f2-project', 'seed-npq-activity-template', 'seed-npq-activity-template-v1', datetime('now'), ?, 0, 0, datetime('now'))
     ON CONFLICT(projectId) DO UPDATE SET
       templateSetId=excluded.templateSetId,
       templateVersionId=excluded.templateVersionId,
       generatedById=excluded.generatedById,
       updatedAt=datetime('now')`,
    [adminUserId],
  );
  await seedProjectActivities('seed-f2-project', activityTemplates);
  await seedStageGateRecords('seed-f2-project', activityTemplates);
  await seedNpqActionPermissions();
  console.log('  ✓ F2 sample project activity instance: seed-f2-project');

  console.log('\n✅ Seed complete.');
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

async function seedStructuredActivityTemplate(templates: QualityActivityTemplateRow[]) {
  const templateSetId = 'seed-npq-activity-template';
  const versionId = 'seed-npq-activity-template-v1';

  await executeWithRetry(
    `INSERT INTO ActivityTemplateSet
       (id, code, name, description, isBuiltIn, isActive, latestPublishedVersionId, createdAt, updatedAt)
     VALUES (?, 'npq-quality-activity', 'NPQ quality activity template', 'Built-in NPQ activity template generated from the quality activity checklist.', 1, 1, NULL, datetime('now'), datetime('now'))
     ON CONFLICT(code) DO UPDATE SET
       name=excluded.name,
       description=excluded.description,
       isBuiltIn=1,
       isActive=1,
       updatedAt=datetime('now')`,
    [templateSetId],
  );

  await executeWithRetry(
    `INSERT INTO ActivityTemplateVersion
       (id, templateSetId, version, status, publishedAt, notes, createdAt, updatedAt)
     VALUES (?, ?, 1, 'published', datetime('now'), 'Seeded from quality-activity-template.json', datetime('now'), datetime('now'))
     ON CONFLICT(templateSetId, version) DO UPDATE SET
       status='published',
       publishedAt=COALESCE(ActivityTemplateVersion.publishedAt, excluded.publishedAt),
       notes=excluded.notes,
       updatedAt=datetime('now')`,
    [versionId, templateSetId],
  );

  await executeWithRetry(
    `UPDATE ActivityTemplateSet
     SET latestPublishedVersionId = ?, updatedAt = datetime('now')
     WHERE id = ?`,
    [versionId, templateSetId],
  );

  const stageOrder = new Map<string, number>();
  const parentKeyToId = new Map<string, string>();
  let parentIndex = 0;

  for (const row of templates) {
    if (!stageOrder.has(row.stage)) stageOrder.set(row.stage, stageOrder.size + 1);
    const stageId = `ats-${slug(row.stage)}`;
    await executeWithRetry(
      `INSERT INTO ActivityTemplateStage (id, versionId, name, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(versionId, name) DO UPDATE SET
         sortOrder=excluded.sortOrder,
         updatedAt=datetime('now')`,
      [stageId, versionId, row.stage, stageOrder.get(row.stage) ?? 0],
    );

    const parentKey = `${row.stage}::${row.projectTaskName}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      parentIndex += 1;
      parentId = `atp-${parentIndex}`;
      parentKeyToId.set(parentKey, parentId);
      await executeWithRetry(
        `INSERT INTO ActivityTemplateParent
           (id, stageId, name, plannedOffsetDays, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(stageId, name) DO UPDATE SET
           plannedOffsetDays=excluded.plannedOffsetDays,
           sortOrder=excluded.sortOrder,
           updatedAt=datetime('now')`,
        [parentId, stageId, row.projectTaskName, 30, parentIndex],
      );
    }

    const roleId = responsiblePositionRoleId(row.ownerRole, row.roleGroup);
    await executeWithRetry(
      `INSERT INTO ActivityTemplateChild
         (id, parentId, title, ownerRoleName, roleGroup, responsibleRoleId,
          deliverableName, requiresDeliverable, requiresAttachment, requiresNote,
          isRequired, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
       ON CONFLICT(parentId, title, ownerRoleName) DO UPDATE SET
         roleGroup=excluded.roleGroup,
         responsibleRoleId=excluded.responsibleRoleId,
         deliverableName=excluded.deliverableName,
         requiresDeliverable=excluded.requiresDeliverable,
         requiresAttachment=excluded.requiresAttachment,
         requiresNote=excluded.requiresNote,
         isRequired=1,
         sortOrder=excluded.sortOrder,
         updatedAt=datetime('now')`,
      [
        `atc-${row.sortOrder}`,
        parentId,
        row.thirdLevelPlan,
        row.ownerRole,
        row.roleGroup,
        roleId,
        row.deliverableName,
        row.requiresDeliverable ? 1 : 0,
        row.requiresDeliverable ? 1 : 0,
        row.requiresDeliverable ? 0 : 1,
        row.sortOrder,
      ],
    );
  }
}

async function seedStageGateRecords(projectId: string, templates: QualityActivityTemplateRow[]) {
  const stages = [...new Set(templates.map((row) => row.stage))];
  for (const stage of stages) {
    await executeWithRetry(
      `INSERT INTO StageGateRecord (id, projectId, stage, status, createdAt, updatedAt)
       VALUES (?, ?, ?, 'pending', datetime('now'), datetime('now'))
       ON CONFLICT(projectId, stage) DO UPDATE SET updatedAt=datetime('now')`,
      [`sgr-${projectId}-${slug(stage)}`, projectId, stage],
    );
  }
}

async function seedNpqActionPermissions() {
  const npqActions = [
    'template.manage',
    'project.create',
    'project.assign_positions',
    'activity.snapshot_adjust',
    'activity.parent_close',
    'activity.child_return',
    'activity.batch_update',
    'stage_gate.pass',
  ];
  const executorActions = [
    'activity.child_update_own',
    'activity.attachment_upload_own',
  ];

  for (const actionKey of npqActions) {
    await executeWithRetry(
      `INSERT INTO NpqActionPermission (id, actionKey, positionRoleId, canExecute, scope, description, createdAt, updatedAt)
       VALUES (?, ?, 'pos-npq', 1, 'project', 'Seed NPQ full activity-flow permission', datetime('now'), datetime('now'))
       ON CONFLICT(actionKey, positionRoleId) DO UPDATE SET
         canExecute=1,
         scope=excluded.scope,
         description=excluded.description,
         updatedAt=datetime('now')`,
      [`perm-npq-${slug(actionKey)}`, actionKey],
    );
  }

  for (const [roleId, code] of positionRoleSeeds) {
    if (code === 'NPQ' || code === 'MANAGER') continue;
    for (const actionKey of executorActions) {
      await executeWithRetry(
        `INSERT INTO NpqActionPermission (id, actionKey, positionRoleId, canExecute, scope, description, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, 'own_task', 'Seed executor own-task permission', datetime('now'), datetime('now'))
         ON CONFLICT(actionKey, positionRoleId) DO UPDATE SET
           canExecute=1,
           scope=excluded.scope,
           description=excluded.description,
           updatedAt=datetime('now')`,
        [`perm-${code.toLowerCase()}-${slug(actionKey)}`, actionKey, roleId],
      );
    }
  }
}

async function seedProjectActivities(
  projectId: string,
  templates: QualityActivityTemplateRow[],
) {
  const parentKeyToId = new Map<string, string>();
  let parentIndex = 0;

  for (const row of templates) {
    const parentKey = `${row.stage}::${row.projectTaskName}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      parentIndex += 1;
      parentId = `pa-${parentIndex}`;
      parentKeyToId.set(parentKey, parentId);
      await executeWithRetry(
        `INSERT INTO ProjectActivityParent
           (id, projectId, templateParentId, stage, projectTaskName, status, plannedDueDate,
            progressPercent, hasBlocked, hasOverdue, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'not_started', date('now', '+30 days'), 0, 0, 0, ?, datetime('now'), datetime('now'))
         ON CONFLICT(projectId, stage, projectTaskName) DO UPDATE SET
           templateParentId=excluded.templateParentId,
           sortOrder=excluded.sortOrder,
           updatedAt=datetime('now')`,
        [parentId, projectId, `atp-${parentIndex}`, row.stage, row.projectTaskName, parentIndex],
      );
    }

    const childId = `pac-${row.sortOrder}`;
    await executeWithRetry(
      `INSERT INTO ProjectActivityChild
         (id, projectId, parentId, templateChildId, thirdLevelPlan, ownerRole, roleGroup,
          responsibleRoleId, assigneeUserId, status, requiresDeliverable, requiresAttachment,
          requiresNote, deliverableName, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'not_started', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(parentId, thirdLevelPlan, ownerRole) DO UPDATE SET
         templateChildId=excluded.templateChildId,
         roleGroup=excluded.roleGroup,
         responsibleRoleId=excluded.responsibleRoleId,
         requiresDeliverable=excluded.requiresDeliverable,
         requiresAttachment=excluded.requiresAttachment,
         requiresNote=excluded.requiresNote,
         deliverableName=excluded.deliverableName,
         sortOrder=excluded.sortOrder,
         updatedAt=datetime('now')`,
      [
        childId,
        projectId,
        parentId,
        `atc-${row.sortOrder}`,
        row.thirdLevelPlan,
        row.ownerRole,
        row.roleGroup,
        responsiblePositionRoleId(row.ownerRole, row.roleGroup),
        row.requiresDeliverable ? 1 : 0,
        row.requiresDeliverable ? 1 : 0,
        row.requiresDeliverable ? 0 : 1,
        row.deliverableName,
        row.sortOrder,
      ],
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.close());
