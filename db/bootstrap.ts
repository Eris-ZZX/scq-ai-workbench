import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { closeDatabase, getDatabase } from './client';
import {
  ActivityTemplate,
  ActivityTemplateChild,
  ActivityTemplateParent,
  ActivityTemplateSet,
  ActivityTemplateStage,
  ActivityTemplateVersion,
  AiResourceMembership,
  AiResourceModuleSettings,
  ComponentConfig,
  PositionRole,
  ProjectRole,
  StageTemplate,
  User,
} from './schema';

const SOURCE_BATCH_ID = 'quality-activity-template-20260611';
const TEMPLATE_SET_ID = 'seed-npq-activity-template';
const TEMPLATE_VERSION_ID = 'seed-npq-activity-template-v1';

type QualityActivityTemplateRow = {
  stage: string;
  projectTaskName: string;
  thirdLevelPlan: string;
  ownerRole: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  sortOrder: number;
};

const positionRoles = [
  ['pos-npq', 'NPQ', 'New Product Quality owner'],
  ['pos-pqe', 'PQE', 'Process Quality Engineering'],
  ['pos-sqe', 'SQE-塑胶', 'Supplier Quality Engineering - plastic'],
  ['pos-sqe-metal', 'SQE-五金', 'Supplier Quality Engineering - metal'],
  ['pos-sqe-smt', 'SQE-SMT代表', 'Supplier Quality Engineering - SMT'],
  ['pos-sqe-packaging', 'SQE-包材', 'Supplier Quality Engineering - packaging'],
  ['pos-sqe-custom-electronics', 'SQE-定制电子代表', 'Supplier Quality Engineering - custom electronics'],
  ['pos-sqe-silicone', 'SQE-硅胶', 'Supplier Quality Engineering - silicone'],
  ['pos-fae', 'FAE', 'Field Application Engineering'],
  ['pos-ram', 'RAM', 'Reliability and Maintainability'],
  ['pos-qcm', 'QCM', 'Quality Control Management'],
  ['pos-manager', '管理者', 'Business read-only manager'],
  ['pos-pqe-engineer', 'PQE工程师', 'PQE engineer'],
  ['pos-sqe-engineer', 'SQE工程师', 'SQE engineer'],
  ['pos-qc', '品质工程师', 'Quality engineer'],
  ['pos-npq-engineer', 'NPQ工程师', 'NPQ engineer'],
  ['pos-ems-engineer', 'EMS工程师', 'EMS engineer'],
  ['pos-fae-engineer', 'FAE工程师', 'FAE engineer'],
  ['pos-ram-engineer', '可靠性工程师', 'Reliability engineer'],
] as const;

const components = [
  ['cmp-workbench', '个人项目工作台', '/workbench'],
  ['cmp-npq-activities', '批量修改', '/flows/npq/activities'],
  ['cmp-npq-activity-dashboard', '活动管理看板', '/flows/npq/activity-dashboard'],
  ['cmp-admin-projects', '项目管理', '/admin/projects'],
  ['cmp-admin-templates', '模板中心', '/admin/templates'],
  ['cmp-admin-positions', '岗位角色', '/admin/positions'],
  ['cmp-admin-users', '用户管理', '/admin/users'],
  ['cmp-admin-components', '功能组件管理', '/admin/components'],
  ['cmp-admin-observability', '运行日志', '/admin/observability'],
] as const;

const componentDependencies: Record<string, string> = {
  'cmp-npq-activity-dashboard': 'cmp-npq-activities',
  'cmp-admin-users': 'cmp-admin-positions',
  'cmp-admin-components': 'cmp-admin-templates',
};

const roleByOwner: Record<string, string> = {
  NPQ: 'pos-npq',
  PQE: 'pos-pqe',
  FAE: 'pos-fae',
  RAM: 'pos-ram',
  QCM: 'pos-qcm',
  'SQE-塑胶': 'pos-sqe',
  'SQE-五金': 'pos-sqe-metal',
  'SQE-SMT代表': 'pos-sqe-smt',
  'SQE-包材': 'pos-sqe-packaging',
  'SQE-定制电子代表': 'pos-sqe-custom-electronics',
  'SQE-硅胶': 'pos-sqe-silicone',
};

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

async function insertChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  size = 200,
) {
  for (let offset = 0; offset < rows.length; offset += size) {
    await insert(rows.slice(offset, offset + size));
  }
}

async function ensureAdmin() {
  const database = getDatabase();
  const [existing] = await database
    .select({ id: User.id })
    .from(User)
    .where(eq(User.username, 'admin'))
    .limit(1);

  if (existing) return existing.id;

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required when creating the initial admin account');
  }
  if (initialPassword.length < 8 || initialPassword.length > 128) {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain 8 to 128 characters');
  }

  const [created] = await database
    .insert(User)
    .values({
      id: 'seed-admin',
      username: 'admin',
      passwordHash: await bcrypt.hash(initialPassword, 12),
      role: 'admin',
      status: 'active',
    })
    .onConflictDoNothing()
    .returning({ id: User.id });

  if (created) return created.id;
  const [concurrent] = await database
    .select({ id: User.id })
    .from(User)
    .where(eq(User.username, 'admin'))
    .limit(1);
  if (!concurrent) throw new Error('Initial admin creation failed');
  return concurrent.id;
}

async function ensureBaseDictionaries() {
  const database = getDatabase();
  await database.insert(StageTemplate).values(
    ['概念评审', '方案评审', '样机评审', '试产评审', '量产准入', '项目结项'].map(
      (label, index) => ({
        id: `seed-tr${index + 1}`,
        name: `TR${index + 1} ${label}`,
        order: index + 1,
        isDefault: true,
      }),
    ),
  ).onConflictDoNothing();

  await database.insert(PositionRole).values(
    positionRoles.map(([id, name, description], index) => ({
      id,
      name,
      description,
      isActive: true,
      sortOrder: index + 1,
    })),
  ).onConflictDoNothing();

  await database.insert(ProjectRole).values(
    ['NPQ', 'PQE', 'SQE', 'FAE', 'RAM', 'QCM'].map((code, index) => ({
      id: `project-role-${code.toLowerCase()}`,
      code,
      name: code,
      sortOrder: index + 1,
      isActive: true,
    })),
  ).onConflictDoNothing();

  await database.insert(ComponentConfig).values(
    components.map(([id, name, path], index) => ({
      id,
      name,
      path,
      order: index + 1,
      enabled: true,
      dependsOnId: componentDependencies[id] ?? null,
    })),
  ).onConflictDoNothing();

  await database
    .insert(AiResourceModuleSettings)
    .values({ id: 'default' })
    .onConflictDoNothing();
}

async function loadActivityTemplate() {
  const path = join(process.cwd(), 'db', 'seed-data', 'quality-activity-template.json');
  return JSON.parse(await readFile(path, 'utf8')) as QualityActivityTemplateRow[];
}

async function ensureNpQTemplate(rows: QualityActivityTemplateRow[]) {
  const database = getDatabase();

  await insertChunks(
    rows.map((row) => ({
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
    })),
    (chunk) => database.insert(ActivityTemplate).values(chunk).onConflictDoNothing(),
  );

  await database.insert(ActivityTemplateSet).values({
    id: TEMPLATE_SET_ID,
    code: 'npq-quality-activity',
    name: 'NPQ quality activity template',
    description: 'Built-in NPQ activity template generated from the quality activity checklist.',
    isBuiltIn: true,
    isActive: true,
  }).onConflictDoNothing();

  await database.insert(ActivityTemplateVersion).values({
    id: TEMPLATE_VERSION_ID,
    templateSetId: TEMPLATE_SET_ID,
    version: 1,
    status: 'published',
    publishedAt: new Date(),
    notes: 'Seeded from quality-activity-template.json',
  }).onConflictDoNothing();

  const stageOrder = new Map<string, number>();
  const parentIds = new Map<string, string>();
  const stages: Array<typeof ActivityTemplateStage.$inferInsert> = [];
  const parents: Array<typeof ActivityTemplateParent.$inferInsert> = [];
  const children: Array<typeof ActivityTemplateChild.$inferInsert> = [];

  for (const row of rows) {
    if (!stageOrder.has(row.stage)) {
      stageOrder.set(row.stage, stageOrder.size + 1);
      stages.push({
        id: `ats-${slug(row.stage)}`,
        versionId: TEMPLATE_VERSION_ID,
        name: row.stage,
        sortOrder: stageOrder.size,
      });
    }
    const stageId = `ats-${slug(row.stage)}`;
    const parentKey = `${row.stage}::${row.projectTaskName}`;
    let parentId = parentIds.get(parentKey);
    if (!parentId) {
      parentId = `atp-${parentIds.size + 1}`;
      parentIds.set(parentKey, parentId);
      parents.push({
        id: parentId,
        stageId,
        name: row.projectTaskName,
        plannedOffsetDays: 30,
        sortOrder: parentIds.size,
      });
    }
    children.push({
      id: `atc-${row.sortOrder}`,
      parentId,
      title: row.thirdLevelPlan,
      ownerRoleName: row.ownerRole,
      responsibleRoleId: roleByOwner[row.ownerRole.trim()] ?? null,
      deliverableName: row.deliverableName,
      requiresDeliverable: row.requiresDeliverable,
      requiresAttachment: row.requiresDeliverable,
      requiresNote: !row.requiresDeliverable,
      isRequired: true,
      sortOrder: row.sortOrder,
    });
  }

  await database.insert(ActivityTemplateStage).values(stages).onConflictDoNothing();
  await insertChunks(
    parents,
    (chunk) => database.insert(ActivityTemplateParent).values(chunk).onConflictDoNothing(),
  );
  await insertChunks(
    children,
    (chunk) => database.insert(ActivityTemplateChild).values(chunk).onConflictDoNothing(),
  );

  await database
    .update(ActivityTemplateSet)
    .set({ latestPublishedVersionId: TEMPLATE_VERSION_ID })
    .where(and(
      eq(ActivityTemplateSet.id, TEMPLATE_SET_ID),
      isNull(ActivityTemplateSet.latestPublishedVersionId),
    ));
}

export async function bootstrapDatabase() {
  await ensureBaseDictionaries();
  const adminId = await ensureAdmin();
  const database = getDatabase();
  await database.insert(AiResourceMembership).values({
    id: 'seed-admin-ai-membership',
    userId: adminId,
    role: 'admin',
    updatedById: adminId,
  }).onConflictDoNothing();
  await ensureNpQTemplate(await loadActivityTemplate());
}

if (process.argv[1]?.endsWith('bootstrap.ts')) {
  bootstrapDatabase()
    .then(() => console.log('Database bootstrap complete.'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Database bootstrap failed');
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
