import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true, session };
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

  const versionIds = sets.flatMap((set) => set.versions.map((version) => version.id));
  const stages = versionIds.length
    ? await prisma.activityTemplateStage.findMany({
      where: { versionId: { in: versionIds } },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
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
    const versions = set.versions.map((version) => ({
      ...version,
      stages: stagesByVersionId.get(version.id) ?? [],
    }));
    const version = versions.find((item) => item.id === set.latestPublishedVersionId) ?? versions[0];
    const stages = version?.stages ?? [];
    const parentCount = stages.reduce((sum, stage) => sum + stage.parents.length, 0);
    const childCount = stages.reduce(
      (sum, stage) => sum + stage.parents.reduce((inner, parent) => inner + parent.children.length, 0),
      0,
    );

    return {
      ...set,
      versions,
      stats: { stageCount: stages.length, parentCount, childCount },
    };
  });
}

async function copyVersionStructure(params: {
  sourceVersionId: string;
  targetTemplateSetId: string;
  targetVersionId: string;
}) {
  const source = await prisma.activityTemplateVersion.findUnique({
    where: { id: params.sourceVersionId },
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

  for (const stage of source.stages) {
    const createdStage = await prisma.activityTemplateStage.create({
      data: {
        versionId: params.targetVersionId,
        code: stage.code,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
      select: { id: true },
    });

    for (const parent of stage.parents) {
      const createdParent = await prisma.activityTemplateParent.create({
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
        await prisma.activityTemplateChild.create({
          data: {
            parentId: createdParent.id,
            title: child.title,
            ownerRoleName: child.ownerRoleName,
            roleGroup: child.roleGroup,
            responsibleRoleId: child.responsibleRoleId,
            deliverableName: child.deliverableName,
            requiresDeliverable: child.requiresDeliverable,
            requiresAttachment: child.requiresAttachment,
            requiresNote: child.requiresNote,
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
      const code = cleanText(body.code) || `${toTemplateCode(name)}-${Date.now()}`;

      const created = await prisma.activityTemplateSet.create({
        data: {
          code,
          name,
          description: cleanText(body.description) || null,
          versions: { create: { version: 1, status: 'draft' } },
        },
      });
      return NextResponse.json(created, { status: 201 });
    }

    if (action === 'duplicateTemplate') {
      const sourceSetId = cleanText(body.sourceSetId);
      const name = cleanText(body.name);
      if (!sourceSetId || !name) return NextResponse.json({ error: '缺少复制来源或模板名称' }, { status: 400 });

      const sourceSet = await prisma.activityTemplateSet.findUnique({
        where: { id: sourceSetId },
        include: { latestPublishedVersion: true },
      });
      if (!sourceSet?.latestPublishedVersion) return NextResponse.json({ error: '复制来源没有已发布版本' }, { status: 400 });

      const created = await prisma.$transaction(async (tx) => {
        const set = await tx.activityTemplateSet.create({
          data: {
            code: `${toTemplateCode(name)}-${Date.now()}`,
            name,
            description: cleanText(body.description) || `复制自 ${sourceSet.name}`,
            isBuiltIn: false,
          },
        });
        const version = await tx.activityTemplateVersion.create({
          data: { templateSetId: set.id, version: 1, status: 'draft', sourceVersionId: sourceSet.latestPublishedVersion!.id },
        });
        return { set, version };
      });

      await copyVersionStructure({
        sourceVersionId: sourceSet.latestPublishedVersion.id,
        targetTemplateSetId: created.set.id,
        targetVersionId: created.version.id,
      });
      return NextResponse.json(created.set, { status: 201 });
    }

    if (action === 'addStage') {
      const versionId = cleanText(body.versionId);
      const code = cleanText(body.code);
      const name = cleanText(body.name) || code;
      if (!versionId || !code) return NextResponse.json({ error: '缺少版本或阶段编码' }, { status: 400 });
      const count = await prisma.activityTemplateStage.count({ where: { versionId } });
      const stage = await prisma.activityTemplateStage.create({
        data: { versionId, code, name, sortOrder: count + 1 },
      });
      return NextResponse.json(stage, { status: 201 });
    }

    if (action === 'addParent') {
      const stageId = cleanText(body.stageId);
      const name = cleanText(body.name);
      if (!stageId || !name) return NextResponse.json({ error: '缺少阶段或母任务名称' }, { status: 400 });
      const count = await prisma.activityTemplateParent.count({ where: { stageId } });
      const parent = await prisma.activityTemplateParent.create({
        data: { stageId, name, sortOrder: count + 1, plannedOffsetDays: Number(body.plannedOffsetDays) || null },
      });
      return NextResponse.json(parent, { status: 201 });
    }

    if (action === 'addChild') {
      const parentId = cleanText(body.parentId);
      const title = cleanText(body.title);
      const roleGroup = cleanText(body.roleGroup);
      if (!parentId || !title || !roleGroup) return NextResponse.json({ error: '缺少母任务、子任务或岗位' }, { status: 400 });
      const role = await prisma.positionRole.findUnique({ where: { code: roleGroup } });
      const count = await prisma.activityTemplateChild.count({ where: { parentId } });
      const child = await prisma.activityTemplateChild.create({
        data: {
          parentId,
          title,
          ownerRoleName: cleanText(body.ownerRoleName) || roleGroup,
          roleGroup,
          responsibleRoleId: role?.id,
          deliverableName: cleanText(body.deliverableName) || null,
          requiresDeliverable: Boolean(body.requiresDeliverable),
          requiresAttachment: Boolean(body.requiresDeliverable),
          requiresNote: !body.requiresDeliverable,
          sortOrder: count + 1,
        },
      });
      return NextResponse.json(child, { status: 201 });
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
    if (body.action === 'updateSet') {
      const id = cleanText(body.id);
      if (!id) return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 });
      const updated = await prisma.activityTemplateSet.update({
        where: { id },
        data: {
          name: cleanText(body.name) || undefined,
          description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.action === 'createDraft') {
      const templateSetId = cleanText(body.templateSetId);
      if (!templateSetId) return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 });
      const set = await prisma.activityTemplateSet.findUnique({
        where: { id: templateSetId },
        include: { latestPublishedVersion: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (!set?.latestPublishedVersion) return NextResponse.json({ error: '没有可复制的已发布版本' }, { status: 400 });

      const nextVersion = (set.versions[0]?.version ?? 0) + 1;
      const draft = await prisma.activityTemplateVersion.create({
        data: { templateSetId, version: nextVersion, status: 'draft', sourceVersionId: set.latestPublishedVersion.id },
      });
      await copyVersionStructure({
        sourceVersionId: set.latestPublishedVersion.id,
        targetTemplateSetId: templateSetId,
        targetVersionId: draft.id,
      });
      return NextResponse.json(draft);
    }

    if (body.action === 'publishVersion') {
      const versionId = cleanText(body.versionId);
      if (!versionId) return NextResponse.json({ error: '缺少版本 ID' }, { status: 400 });
      const published = await prisma.$transaction(async (tx) => {
        const version = await tx.activityTemplateVersion.findUnique({ where: { id: versionId } });
        if (!version) throw new Error('VERSION_NOT_FOUND');
        await tx.activityTemplateVersion.updateMany({
          where: { templateSetId: version.templateSetId, status: 'published' },
          data: { status: 'retired' },
        });
        const next = await tx.activityTemplateVersion.update({
          where: { id: versionId },
          data: { status: 'published', publishedAt: new Date(), publishedById: r.session.sub },
        });
        await tx.activityTemplateSet.update({
          where: { id: version.templateSetId },
          data: { latestPublishedVersionId: versionId, isActive: true },
        });
        return next;
      });
      return NextResponse.json(published);
    }

    if (body.action === 'updateStage') {
      const id = cleanText(body.id);
      const updated = await prisma.activityTemplateStage.update({
        where: { id },
        data: { code: cleanText(body.code) || undefined, name: cleanText(body.name) || undefined },
      });
      return NextResponse.json(updated);
    }

    if (body.action === 'updateParent') {
      const id = cleanText(body.id);
      const updated = await prisma.activityTemplateParent.update({
        where: { id },
        data: {
          name: cleanText(body.name) || undefined,
          description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
          closureStandard: typeof body.closureStandard === 'string' ? body.closureStandard.trim() || null : undefined,
          plannedOffsetDays: typeof body.plannedOffsetDays === 'number' ? body.plannedOffsetDays : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.action === 'updateChild') {
      const id = cleanText(body.id);
      const roleGroup = cleanText(body.roleGroup);
      const role = roleGroup ? await prisma.positionRole.findUnique({ where: { code: roleGroup } }) : null;
      const updated = await prisma.activityTemplateChild.update({
        where: { id },
        data: {
          title: cleanText(body.title) || undefined,
          ownerRoleName: cleanText(body.ownerRoleName) || undefined,
          roleGroup: roleGroup || undefined,
          responsibleRoleId: roleGroup ? role?.id ?? null : undefined,
          deliverableName: typeof body.deliverableName === 'string' ? body.deliverableName.trim() || null : undefined,
          requiresDeliverable: typeof body.requiresDeliverable === 'boolean' ? body.requiresDeliverable : undefined,
          requiresAttachment: typeof body.requiresDeliverable === 'boolean' ? body.requiresDeliverable : undefined,
          requiresNote: typeof body.requiresDeliverable === 'boolean' ? !body.requiresDeliverable : undefined,
          isRequired: typeof body.isRequired === 'boolean' ? body.isRequired : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '模板更新失败' }, { status: 500 });
  }
}
