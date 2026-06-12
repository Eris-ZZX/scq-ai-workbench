import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

type TemplateWriteClient = Pick<
  typeof prisma,
  | 'activityTemplateSet'
  | 'activityTemplateVersion'
  | 'activityTemplateStage'
  | 'activityTemplateParent'
  | 'activityTemplateChild'
  | 'positionRole'
  | 'projectActivitySnapshotMeta'
>;

type TemplateChildInput = {
  title: string;
  ownerRoleName: string;
  roleGroup: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  isRequired: boolean;
  sortOrder: number;
};

type TemplateParentInput = {
  name: string;
  description: string | null;
  closureStandard: string | null;
  plannedOffsetDays: number | null;
  sortOrder: number;
  children: TemplateChildInput[];
};

type TemplateStageInput = {
  name: string;
  sortOrder: number;
  parents: TemplateParentInput[];
};

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 } as const;
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 } as const;
  return { ok: true, session } as const;
}

function toTemplateCode(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `template-${Date.now()}`;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseTemplateStages(value: unknown): TemplateStageInput[] {
  const stages: TemplateStageInput[] = [];

  for (const [stageIndex, rawStage] of asArray(value).entries()) {
    const stageRecord = asRecord(rawStage);
    const name = cleanText(stageRecord.name);
    if (!name) continue;

    const parents: TemplateParentInput[] = [];
    for (const [parentIndex, rawParent] of asArray(stageRecord.parents).entries()) {
      const parentRecord = asRecord(rawParent);
      const parentName = cleanText(parentRecord.name);
      if (!parentName) continue;

      const children: TemplateChildInput[] = [];
      for (const [childIndex, rawChild] of asArray(parentRecord.children).entries()) {
        const childRecord = asRecord(rawChild);
        const title = cleanText(childRecord.title);
        const roleGroup = cleanText(childRecord.roleGroup) || 'NPQ';
        if (!title) continue;

        children.push({
          title,
          ownerRoleName: cleanText(childRecord.ownerRoleName) || roleGroup,
          roleGroup,
          deliverableName: cleanOptionalText(childRecord.deliverableName),
          requiresDeliverable: Boolean(childRecord.requiresDeliverable),
          isRequired: typeof childRecord.isRequired === 'boolean' ? childRecord.isRequired : true,
          sortOrder: childIndex + 1,
        });
      }

      parents.push({
        name: parentName,
        description: cleanOptionalText(parentRecord.description),
        closureStandard: cleanOptionalText(parentRecord.closureStandard),
        plannedOffsetDays: cleanNumber(parentRecord.plannedOffsetDays),
        sortOrder: parentIndex + 1,
        children,
      });
    }

    stages.push({
      name,
      sortOrder: stageIndex + 1,
      parents,
    });
  }

  return stages;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function getTemplateCenterView() {
  const sets = await prisma.activityTemplateSet.findMany({
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });

  const activeVersionIds = sets
    .map((set) => set.latestPublishedVersionId ?? set.versions[0]?.id)
    .filter((id): id is string => Boolean(id));
  const stages = activeVersionIds.length
    ? await prisma.activityTemplateStage.findMany({
      where: { versionId: { in: activeVersionIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    : [];
  const stageIds = stages.map((stage) => stage.id);
  const parents = stageIds.length
    ? await prisma.activityTemplateParent.findMany({
      where: { stageId: { in: stageIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    : [];
  const parentIds = parents.map((parent) => parent.id);
  const children = parentIds.length
    ? (await Promise.all(chunk(parentIds, 400).map((ids) => prisma.activityTemplateChild.findMany({
      where: { parentId: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    })))).flat()
    : [];

  const childrenByParentId = new Map<string, typeof children>();
  for (const child of children) {
    const list = childrenByParentId.get(child.parentId) ?? [];
    list.push(child);
    childrenByParentId.set(child.parentId, list);
  }

  const parentsByStageId = new Map<string, Array<(typeof parents)[number] & { children: typeof children }>>();
  for (const parent of parents) {
    const list = parentsByStageId.get(parent.stageId) ?? [];
    list.push({ ...parent, children: childrenByParentId.get(parent.id) ?? [] });
    parentsByStageId.set(parent.stageId, list);
  }

  const stagesByVersionId = new Map<string, Array<(typeof stages)[number] & { parents: Array<(typeof parents)[number] & { children: typeof children }> }>>();
  for (const stage of stages) {
    const list = stagesByVersionId.get(stage.versionId) ?? [];
    list.push({ ...stage, parents: parentsByStageId.get(stage.id) ?? [] });
    stagesByVersionId.set(stage.versionId, list);
  }

  return sets.map((set) => {
    const activeVersionId = set.latestPublishedVersionId ?? set.versions[0]?.id;
    const versions = set.versions.map((version) => ({
      ...version,
      stages: version.id === activeVersionId ? stagesByVersionId.get(version.id) ?? [] : [],
    }));
    const version = versions.find((item) => item.id === set.latestPublishedVersionId) ?? versions[0];
    const viewStages = version?.stages ?? [];
    const parentCount = viewStages.reduce((sum, stage) => sum + stage.parents.length, 0);
    const childCount = viewStages.reduce(
      (sum, stage) => sum + stage.parents.reduce((inner, parent) => inner + parent.children.length, 0),
      0,
    );

    return {
      ...set,
      versions,
      stats: { stageCount: viewStages.length, parentCount, childCount },
    };
  });
}

async function copyVersionStructure(client: TemplateWriteClient, sourceVersionId: string, targetVersionId: string) {
  const source = await client.activityTemplateVersion.findUnique({
    where: { id: sourceVersionId },
    include: {
      stages: {
        orderBy: { sortOrder: 'asc' },
        include: {
          parents: {
            orderBy: { sortOrder: 'asc' },
            include: { children: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
  });
  if (!source) throw new Error('SOURCE_VERSION_NOT_FOUND');

  const stages = source.stages.map((stage) => ({
    name: stage.name,
    sortOrder: stage.sortOrder,
    parents: stage.parents.map((parent) => ({
      name: parent.name,
      description: parent.description,
      closureStandard: parent.closureStandard,
      plannedOffsetDays: parent.plannedOffsetDays,
      sortOrder: parent.sortOrder,
      children: parent.children.map((child) => ({
        title: child.title,
        ownerRoleName: child.ownerRoleName,
        roleGroup: child.roleGroup,
        deliverableName: child.deliverableName,
        requiresDeliverable: child.requiresDeliverable,
        isRequired: child.isRequired,
        sortOrder: child.sortOrder,
      })),
    })),
  }));

  await createVersionStructure(client, targetVersionId, stages);
}

async function createVersionStructure(client: TemplateWriteClient, targetVersionId: string, stages: TemplateStageInput[]) {
  const roleCodes = Array.from(new Set(stages.flatMap((stage) => (
    stage.parents.flatMap((parent) => parent.children.map((child) => child.roleGroup))
  ))));
  const roles = roleCodes.length
    ? await client.positionRole.findMany({ where: { code: { in: roleCodes } }, select: { id: true, code: true } })
    : [];
  const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));

  for (const stage of stages) {
    const createdStage = await client.activityTemplateStage.create({
      data: {
        versionId: targetVersionId,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
      select: { id: true },
    });

    for (const parent of stage.parents) {
      const createdParent = await client.activityTemplateParent.create({
        data: {
          stageId: createdStage.id,
          name: parent.name,
          description: parent.description,
          closureStandard: parent.closureStandard,
          plannedOffsetDays: parent.plannedOffsetDays,
          sortOrder: parent.sortOrder,
        },
        select: { id: true },
      });

      for (const child of parent.children) {
        await client.activityTemplateChild.create({
          data: {
            parentId: createdParent.id,
            title: child.title,
            ownerRoleName: child.ownerRoleName,
            roleGroup: child.roleGroup,
            responsibleRoleId: roleIdByCode.get(child.roleGroup),
            deliverableName: child.deliverableName,
            requiresDeliverable: child.requiresDeliverable,
            requiresAttachment: child.requiresDeliverable,
            requiresNote: !child.requiresDeliverable,
            isRequired: child.isRequired,
            sortOrder: child.sortOrder,
          },
        });
      }
    }
  }
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(await getTemplateCenterView());
}

export async function POST(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  try {
    const action = body.action;

    if (action === 'createTemplate') {
      const name = cleanText(body.name);
      if (!name) return NextResponse.json({ error: '请填写模板名称' }, { status: 400 });
      const sourceSetId = cleanText(body.sourceSetId);
      const description = cleanOptionalText(body.description);

      const created = await prisma.$transaction(async (tx) => {
        const sourceSet = sourceSetId
          ? await tx.activityTemplateSet.findUnique({
            where: { id: sourceSetId },
            include: { latestPublishedVersion: true },
          })
          : null;
        if (sourceSetId && !sourceSet?.latestPublishedVersion) throw new Error('SOURCE_TEMPLATE_NOT_FOUND');

        const set = await tx.activityTemplateSet.create({
          data: {
            code: `${toTemplateCode(name)}-${Date.now()}`,
            name,
            description: description ?? (sourceSet ? `从 ${sourceSet.name} 导入` : null),
            isBuiltIn: false,
            isActive: true,
          },
        });
        const version = await tx.activityTemplateVersion.create({
          data: {
            templateSetId: set.id,
            version: 1,
            status: 'published',
            publishedAt: new Date(),
            publishedById: r.session.sub,
            sourceVersionId: sourceSet?.latestPublishedVersion?.id,
            notes: sourceSet ? `从 ${sourceSet.name} 导入创建` : '空白新建',
          },
        });

        if (sourceSet?.latestPublishedVersion) {
          await copyVersionStructure(tx, sourceSet.latestPublishedVersion.id, version.id);
        }

        return tx.activityTemplateSet.update({
          where: { id: set.id },
          data: { latestPublishedVersionId: version.id },
        });
      });

      return NextResponse.json(created, { status: 201 });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '模板操作失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  try {
    if (body.action === 'saveTemplateEdit') {
      const templateSetId = cleanText(body.templateSetId);
      const baseVersionId = cleanText(body.baseVersionId);
      const name = cleanText(body.name);
      if (!templateSetId || !baseVersionId || !name) {
        return NextResponse.json({ error: '缺少模板、版本或名称' }, { status: 400 });
      }

      const stages = parseTemplateStages(body.stages);
      const description = cleanOptionalText(body.description);
      const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
      const changeNotes = cleanOptionalText(body.changeNotes);

      const saved = await prisma.$transaction(async (tx) => {
        const set = await tx.activityTemplateSet.findUnique({
          where: { id: templateSetId },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!set) throw new Error('TEMPLATE_SET_NOT_FOUND');

        await tx.activityTemplateVersion.updateMany({
          where: { templateSetId, status: 'published' },
          data: { status: 'retired' },
        });

        const nextVersion = (set.versions[0]?.version ?? 0) + 1;
        const version = await tx.activityTemplateVersion.create({
          data: {
            templateSetId,
            version: nextVersion,
            status: 'published',
            sourceVersionId: baseVersionId,
            publishedAt: new Date(),
            publishedById: r.session.sub,
            notes: changeNotes || '编辑保存',
          },
        });
        await createVersionStructure(tx, version.id, stages);

        await tx.activityTemplateSet.update({
          where: { id: templateSetId },
          data: {
            name,
            description,
            isActive,
            latestPublishedVersionId: version.id,
          },
        });

        return version;
      });

      return NextResponse.json(saved);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '模板更新失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const set = await tx.activityTemplateSet.findUnique({
        where: { id },
        include: { versions: { select: { id: true } } },
      });
      if (!set) throw new Error('TEMPLATE_SET_NOT_FOUND');

      const versionIds = set.versions.map((version) => version.id);
      await tx.activityTemplateSet.update({
        where: { id },
        data: { latestPublishedVersionId: null },
      });
      await tx.projectActivitySnapshotMeta.deleteMany({
        where: {
          OR: [
            { templateSetId: id },
            { templateVersionId: { in: versionIds } },
          ],
        },
      });
      await tx.activityTemplateSet.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '模板删除失败' }, { status: 500 });
  }
}
