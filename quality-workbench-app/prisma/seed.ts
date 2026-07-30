import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as never);

const templatePath = path.resolve(process.cwd(), 'prisma', 'quality-activity-template.json');
/** Default admin account for seed: username admin / password zx123456. */
const ADMIN_PASSWORD_HASH = '$2b$10$JzlWMbyJ/uamA9DAAepZUedQGn5cdF7hrq4tnhQOnoYy8lwkVFn2S'; // zx123456
const SOURCE_BATCH_ID = 'quality-activity-template-20260611';

const positionRoleSeeds = [
  ['pos-npq', 'NPQ', 'New Product Quality owner', 1],
  ['pos-pqe', 'PQE', 'Process Quality Engineering', 2],
  ['pos-sqe', 'SQE-塑胶', 'Supplier Quality Engineering - plastic', 3],
  ['pos-sqe-metal', 'SQE-五金', 'Supplier Quality Engineering - metal', 4],
  ['pos-sqe-smt', 'SQE-SMT代表', 'Supplier Quality Engineering - SMT', 5],
  ['pos-sqe-packaging', 'SQE-包材', 'Supplier Quality Engineering - packaging', 6],
  ['pos-sqe-custom-electronics', 'SQE-定制电子代表', 'Supplier Quality Engineering - custom electronics', 7],
  ['pos-sqe-silicone', 'SQE-硅胶', 'Supplier Quality Engineering - silicone', 8],
  ['pos-fae', 'FAE', 'Field Application Engineering', 9],
  ['pos-ram', 'RAM', 'Reliability and Maintainability', 10],
  ['pos-qcm', 'QCM', 'Quality Control Management', 11],
  ['pos-manager', '管理者', 'Business read-only manager', 12],
  ['pos-pqe-engineer', 'PQE工程师', 'PQE test account role', 13],
  ['pos-sqe-engineer', 'SQE工程师', 'SQE test account role', 14],
  ['pos-qc', '品质工程师', 'QCM test account role', 15],
  ['pos-npq-engineer', 'NPQ工程师', 'NPQ test account role', 16],
  ['pos-ems-engineer', 'EMS工程师', 'EMS test account role', 17],
  ['pos-fae-engineer', 'FAE工程师', 'FAE test account role', 18],
  ['pos-ram-engineer', '可靠性工程师', 'RAM test account role', 19],
] as const;

function responsiblePositionRoleId(ownerRole: string) {
  const exact: Record<string, string> = {
    'NPQ': 'pos-npq',
    'PQE': 'pos-pqe',
    'FAE': 'pos-fae',
    'RAM': 'pos-ram',
    'QCM': 'pos-qcm',
    'SQE-塑胶': 'pos-sqe',
    'SQE-五金': 'pos-sqe-metal',
    'SQE-SMT代表': 'pos-sqe-smt',
    'SQE-包材': 'pos-sqe-packaging',
    'SQE-定制电子代表': 'pos-sqe-custom-electronics',
    'SQE-硅胶': 'pos-sqe-silicone',
  };
  return exact[ownerRole.trim()] ?? null;
}

type QualityActivityTemplateRow = {
  stage: string;
  projectTaskName: string;
  thirdLevelPlan: string;
  ownerRole: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  sortOrder: number;
};

async function main() {
  console.log('🌱 Seeding database...');
  console.log(`   DB: ${process.env.DATABASE_URL}\n`);

  // ── TR1→TR6 默认阶段模板 ──
  const stages: [string, string, number][] = [
    ['seed-tr1', 'TR1 概念评审', 1],
    ['seed-tr2', 'TR2 方案评审', 2],
    ['seed-tr3', 'TR3 样机评审', 3],
    ['seed-tr4', 'TR4 试产评审', 4],
    ['seed-tr5', 'TR5 量产准入', 5],
    ['seed-tr6', 'TR6 项目结项', 6],
  ];

  for (const [id, name, order] of stages) {
    await prisma.stageTemplate.upsert({
      where: { id },
      update: { name, order },
      create: { id, name, order, isDefault: true },
    });
  }
  console.log('  ✓ Stage templates: TR1→TR6');

  // ── F3 岗位角色 ──
  for (const [id, name, description, sortOrder] of positionRoleSeeds) {
    await prisma.positionRole.upsert({
      where: { id },
      update: { name, description, isActive: true, sortOrder },
      create: { id, name, description, isActive: true, sortOrder },
    });
  }
  console.log(`  F3 position roles: ${positionRoleSeeds.length} seeded`);

  // ── 预注册 MVP 功能组件 ──
  const components: [string, string, string, number][] = [
    ['cmp-workbench', '个人项目工作台', '/workbench', 1],
    ['cmp-npq-activities', '批量修改', '/flows/npq/activities', 2],
    ['cmp-npq-activity-dashboard', '活动管理看板', '/flows/npq/activity-dashboard', 3],
    ['cmp-admin-projects', '项目管理', '/admin/projects', 4],
    ['cmp-admin-templates', '模板中心', '/admin/templates', 5],
    ['cmp-admin-positions', '岗位角色', '/admin/positions', 6],
    ['cmp-admin-users', '用户管理', '/admin/users', 7],
    ['cmp-admin-components', '功能组件管理', '/admin/components', 8],
    ['cmp-admin-observability', '运行日志', '/admin/observability', 9],
  ];

  for (const [id, name, cp, order] of components) {
    await prisma.componentConfig.upsert({
      where: { id },
      update: { name, path: cp, order },
      create: { id, name, path: cp, order, enabled: true },
    });
  }
  // 清理历史遗留组件（幂等重跑用）
  await prisma.componentConfig.updateMany({
    where: { dependsOnId: 'cmp-npq-projects' },
    data: { dependsOnId: null },
  });
  await prisma.componentConfig.deleteMany({
    where: {
      OR: [
        { id: { in: ['cmp-npq-projects', 'cmp-npq-todos', 'cmp-npq-tasks'] } },
        { path: { in: ['/flows/npq/projects', '/flows/npq/todos', '/flows/npq/tasks'] } },
        { id: 'cmp-project-workbench' },
        { path: '/project-workbench' },
      ],
    },
  });
  console.log(`  ✓ Component configs: ${components.length} registered (with F3 positions)`);

  // ── 组件依赖关系 ──
  const deps: [string, string][] = [
    ['cmp-npq-activity-dashboard', 'cmp-npq-activities'],
    ['cmp-admin-users', 'cmp-admin-positions'],
    ['cmp-admin-components', 'cmp-admin-templates'],
  ];
  for (const [childId, parentId] of deps) {
    await prisma.componentConfig.update({
      where: { id: childId },
      data: { dependsOnId: parentId },
    });
  }
  console.log('  ✓ Component dependencies wired');

  // ── F2 质量活动模板库 ──
  const activityTemplates = JSON.parse(
    fs.readFileSync(templatePath, 'utf8'),
  ) as QualityActivityTemplateRow[];

  for (const row of activityTemplates) {
    await prisma.activityTemplate.upsert({
      where: {
        stage_projectTaskName_thirdLevelPlan_ownerRole_sourceBatchId: {
          stage: row.stage,
          projectTaskName: row.projectTaskName,
          thirdLevelPlan: row.thirdLevelPlan,
          ownerRole: row.ownerRole,
          sourceBatchId: SOURCE_BATCH_ID,
        },
      },
      update: {
        deliverableName: row.deliverableName,
        requiresDeliverable: row.requiresDeliverable,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      create: {
        id: `qat-${row.sortOrder}`,
        stage: row.stage,
        projectTaskName: row.projectTaskName,
        thirdLevelPlan: row.thirdLevelPlan,
        ownerRole: row.ownerRole,
        deliverableName: row.deliverableName,
        requiresDeliverable: row.requiresDeliverable,
        sourceBatchId: SOURCE_BATCH_ID,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Activity templates: ${activityTemplates.length} imported`);
  await seedStructuredActivityTemplate(activityTemplates);
  console.log('  F3 structured activity template: default v1 published');

  // ── 仅保留管理员账号；示例项目挂在 admin 名下 ──
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: ADMIN_PASSWORD_HASH, role: 'admin', status: 'active' },
    create: {
      id: 'seed-admin',
      username: 'admin',
      passwordHash: ADMIN_PASSWORD_HASH,
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    },
  });
  const adminUserId = admin.id;

  await prisma.project.upsert({
    where: { id: 'seed-f2-project' },
    update: {
      name: 'F2 新产品导入活动样例项目',
      description: '由质量活动模板库生成的 TR1-TR6 全阶段活动实例',
      status: 'active',
    },
    create: {
      id: 'seed-f2-project',
      name: 'F2 新产品导入活动样例项目',
      description: '由质量活动模板库生成的 TR1-TR6 全阶段活动实例',
      status: 'active',
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: 'seed-f2-project', userId: adminUserId } },
    update: { role: 'owner' },
    create: { id: 'seed-f2-member-admin', projectId: 'seed-f2-project', userId: adminUserId, role: 'owner' },
  });

  await prisma.userPosition.upsert({
    where: { userId: adminUserId },
    update: { positionRoleId: 'pos-npq-engineer' },
    create: { id: 'seed-admin-position', userId: adminUserId, positionRoleId: 'pos-npq-engineer' },
  });

  // Clear legacy seed demo members / role appointments on the sample project.
  await prisma.projectMember.deleteMany({
    where: {
      projectId: 'seed-f2-project',
      userId: { not: adminUserId },
    },
  });
  await prisma.projectPositionAssignment.deleteMany({
    where: { projectId: 'seed-f2-project' },
  });

  await prisma.projectActivitySnapshotMeta.upsert({
    where: { projectId: 'seed-f2-project' },
    update: {
      templateSetId: 'seed-npq-activity-template',
      templateVersionId: 'seed-npq-activity-template-v1',
      generatedById: adminUserId,
    },
    create: {
      id: 'seed-f2-project-template-snapshot',
      projectId: 'seed-f2-project',
      templateSetId: 'seed-npq-activity-template',
      templateVersionId: 'seed-npq-activity-template-v1',
      generatedById: adminUserId,
      localAdjustmentCount: 0,
      notApplicableCount: 0,
    },
  });

  await seedProjectActivities('seed-f2-project', activityTemplates);
  await seedStageGateRecords('seed-f2-project', activityTemplates);
  console.log('  ✓ Admin user + F2 sample project (admin only)');

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

  await prisma.activityTemplateSet.upsert({
    where: { code: 'npq-quality-activity' },
    update: {
      name: 'NPQ quality activity template',
      description: 'Built-in NPQ activity template generated from the quality activity checklist.',
      isBuiltIn: true,
      isActive: true,
    },
    create: {
      id: templateSetId,
      code: 'npq-quality-activity',
      name: 'NPQ quality activity template',
      description: 'Built-in NPQ activity template generated from the quality activity checklist.',
      isBuiltIn: true,
      isActive: true,
    },
  });

  await prisma.activityTemplateVersion.upsert({
    where: { templateSetId_version: { templateSetId, version: 1 } },
    update: {
      status: 'published',
      notes: 'Seeded from quality-activity-template.json',
    },
    create: {
      id: versionId,
      templateSetId,
      version: 1,
      status: 'published',
      publishedAt: new Date(),
      notes: 'Seeded from quality-activity-template.json',
    },
  });

  await prisma.activityTemplateSet.update({
    where: { id: templateSetId },
    data: { latestPublishedVersionId: versionId },
  });

  const stageOrder = new Map<string, number>();
  const parentKeyToId = new Map<string, string>();
  let parentIndex = 0;

  for (const row of templates) {
    if (!stageOrder.has(row.stage)) stageOrder.set(row.stage, stageOrder.size + 1);
    const stageId = `ats-${slug(row.stage)}`;
    await prisma.activityTemplateStage.upsert({
      where: { versionId_name: { versionId, name: row.stage } },
      update: { sortOrder: stageOrder.get(row.stage) ?? 0 },
      create: { id: stageId, versionId, name: row.stage, sortOrder: stageOrder.get(row.stage) ?? 0 },
    });

    const parentKey = `${row.stage}::${row.projectTaskName}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      parentIndex += 1;
      parentId = `atp-${parentIndex}`;
      parentKeyToId.set(parentKey, parentId);
      await prisma.activityTemplateParent.upsert({
        where: { stageId_name: { stageId, name: row.projectTaskName } },
        update: { plannedOffsetDays: 30, sortOrder: parentIndex },
        create: { id: parentId, stageId, name: row.projectTaskName, plannedOffsetDays: 30, sortOrder: parentIndex },
      });
    }

    const roleId = responsiblePositionRoleId(row.ownerRole);
    await prisma.activityTemplateChild.upsert({
      where: {
        parentId_title_ownerRoleName: { parentId, title: row.thirdLevelPlan, ownerRoleName: row.ownerRole },
      },
      update: {
        responsibleRoleId: roleId,
        deliverableName: row.deliverableName,
        requiresDeliverable: row.requiresDeliverable,
        requiresAttachment: row.requiresDeliverable,
        requiresNote: !row.requiresDeliverable,
        isRequired: true,
        sortOrder: row.sortOrder,
      },
      create: {
        id: `atc-${row.sortOrder}`,
        parentId,
        title: row.thirdLevelPlan,
        ownerRoleName: row.ownerRole,
        responsibleRoleId: roleId,
        deliverableName: row.deliverableName,
        requiresDeliverable: row.requiresDeliverable,
        requiresAttachment: row.requiresDeliverable,
        requiresNote: !row.requiresDeliverable,
        isRequired: true,
        sortOrder: row.sortOrder,
      },
    });
  }
}

async function seedStageGateRecords(projectId: string, templates: QualityActivityTemplateRow[]) {
  const stages = [...new Set(templates.map((row) => row.stage))];
  for (const stage of stages) {
    await prisma.stageGateRecord.upsert({
      where: { projectId_stage: { projectId, stage } },
      update: {},
      create: { id: `sgr-${projectId}-${slug(stage)}`, projectId, stage, status: 'pending' },
    });
  }
}

async function seedProjectActivities(projectId: string, templates: QualityActivityTemplateRow[]) {
  const plannedDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const parentKeyToId = new Map<string, string>();
  let parentIndex = 0;

  for (const row of templates) {
    const parentKey = `${row.stage}::${row.projectTaskName}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      parentIndex += 1;
      parentId = `pa-${parentIndex}`;
      parentKeyToId.set(parentKey, parentId);
      await prisma.projectActivityParent.upsert({
        where: {
          projectId_stage_projectTaskName: { projectId, stage: row.stage, projectTaskName: row.projectTaskName },
        },
        update: { templateParentId: `atp-${parentIndex}`, sortOrder: parentIndex },
        create: {
          id: parentId,
          projectId,
          templateParentId: `atp-${parentIndex}`,
          stage: row.stage,
          projectTaskName: row.projectTaskName,
          status: 'not_started',
          plannedDueDate,
          progressPercent: 0,
          hasBlocked: false,
          hasOverdue: false,
          sortOrder: parentIndex,
        },
      });
    }

    await prisma.projectActivityChild.upsert({
      where: {
        parentId_thirdLevelPlan_ownerRole: { parentId, thirdLevelPlan: row.thirdLevelPlan, ownerRole: row.ownerRole },
      },
      update: {
        templateChildId: `atc-${row.sortOrder}`,
        responsibleRoleId: responsiblePositionRoleId(row.ownerRole),
        requiresDeliverable: row.requiresDeliverable,
        requiresAttachment: row.requiresDeliverable,
        requiresNote: !row.requiresDeliverable,
        deliverableName: row.deliverableName,
        sortOrder: row.sortOrder,
      },
      create: {
        id: `pac-${row.sortOrder}`,
        projectId,
        parentId,
        templateChildId: `atc-${row.sortOrder}`,
        thirdLevelPlan: row.thirdLevelPlan,
        ownerRole: row.ownerRole,
        responsibleRoleId: responsiblePositionRoleId(row.ownerRole),
        assigneeUserId: null,
        status: 'not_started',
        requiresDeliverable: row.requiresDeliverable,
        requiresAttachment: row.requiresDeliverable,
        requiresNote: !row.requiresDeliverable,
        deliverableName: row.deliverableName,
        sortOrder: row.sortOrder,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
