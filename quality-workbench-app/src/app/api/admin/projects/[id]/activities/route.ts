import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { getRoleGroup, refreshParentSummary } from '@/lib/db/activities';
import { canManageProject, getProjectAdminAccess } from '@/lib/db/project-admin-access';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

type ActivityChildInput = {
  id?: string;
  thirdLevelPlan?: string;
  ownerRole?: string;
  roleGroup?: string;
  requiresDeliverable?: boolean;
  deliverableName?: string | null;
  sortOrder?: number;
};

type ActivityParentInput = {
  id?: string;
  stage?: string;
  projectTaskName?: string;
  sortOrder?: number;
  children?: ActivityChildInput[];
};

type NormalizedParent = {
  id: string;
  stage: string;
  projectTaskName: string;
  sortOrder: number;
  children: {
    id: string;
    thirdLevelPlan: string;
    ownerRole: string;
    roleGroup: string;
    requiresDeliverable: boolean;
    deliverableName: string | null;
    sortOrder: number;
  }[];
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptional(value: unknown) {
  const text = clean(value);
  return text || null;
}

function roleDisplayName(role: { code: string; name: string; roleName: string | null; roleGroup: string }) {
  return role.roleName?.trim() || role.name || role.code || role.roleGroup;
}

async function buildResponsibleRoleResolver(
  tx: Prisma.TransactionClient,
  children: NormalizedParent['children'],
) {
  const ownerRoles = Array.from(new Set(children.map((child) => child.ownerRole).filter(Boolean)));
  const roleGroups = Array.from(new Set(children.map((child) => child.roleGroup).filter(Boolean)));
  const positionRoles = ownerRoles.length || roleGroups.length
    ? await tx.positionRole.findMany({
        where: {
          isActive: true,
          OR: [
            { roleName: { in: ownerRoles } },
            { code: { in: ownerRoles } },
            { name: { in: ownerRoles } },
            { roleGroup: { in: roleGroups } },
          ],
        },
        select: { id: true, code: true, name: true, roleName: true, roleGroup: true },
      })
    : [];
  const exact = new Map<string, string>();
  const fallback = new Map<string, string>();
  for (const role of positionRoles) {
    exact.set(roleDisplayName(role), role.id);
    exact.set(role.code, role.id);
    if (!fallback.has(role.roleGroup)) fallback.set(role.roleGroup, role.id);
    if (!fallback.has(role.name)) fallback.set(role.name, role.id);
  }
  return (child: NormalizedParent['children'][number]) => exact.get(child.ownerRole) ?? fallback.get(child.roleGroup) ?? null;
}

async function checkProjectManager(projectId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 } as const;
  const access = await getProjectAdminAccess(session);
  if (access.kind === 'none') return { error: '无权访问项目管理', status: 403 } as const;
  if (!(await canManageProject(access, projectId))) return { error: '无权维护该项目', status: 403 } as const;
  return { ok: true, session, access } as const;
}

function projectActivitySelect() {
  return {
    id: true,
    stage: true,
    projectTaskName: true,
    status: true,
    sortOrder: true,
    progressPercent: true,
    hasBlocked: true,
    hasOverdue: true,
    children: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        thirdLevelPlan: true,
        ownerRole: true,
        roleGroup: true,
        responsibleRoleId: true,
        status: true,
        requiresDeliverable: true,
        deliverableName: true,
        sortOrder: true,
        isNotApplicable: true,
      },
    },
  };
}

async function getProjectActivities(projectId: string) {
  return prisma.projectActivityParent.findMany({
    where: { projectId },
    orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: projectActivitySelect(),
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await checkProjectManager(id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  return NextResponse.json({ project, parents: await getProjectActivities(id) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const r = await checkProjectManager(projectId);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { parents?: ActivityParentInput[]; changeNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!Array.isArray(body.parents)) {
    return NextResponse.json({ error: '缺少项目活动树' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  let parents: NormalizedParent[];
  try {
    parents = body.parents.map((parent, parentIndex) => {
      const stage = clean(parent.stage);
      const projectTaskName = clean(parent.projectTaskName);
      if (!stage || !projectTaskName) throw new Error('INVALID_PARENT');
      return {
        id: clean(parent.id),
        stage,
        projectTaskName,
        sortOrder: Number.isFinite(parent.sortOrder) ? Number(parent.sortOrder) : parentIndex + 1,
        children: (parent.children ?? []).map((child, childIndex) => {
          const thirdLevelPlan = clean(child.thirdLevelPlan);
          const ownerRole = clean(child.ownerRole);
          if (!thirdLevelPlan || !ownerRole) throw new Error('INVALID_CHILD');
          return {
            id: clean(child.id),
            thirdLevelPlan,
            ownerRole,
            roleGroup: clean(child.roleGroup) || getRoleGroup(ownerRole),
            requiresDeliverable: Boolean(child.requiresDeliverable),
            deliverableName: cleanOptional(child.deliverableName),
            sortOrder: Number.isFinite(child.sortOrder) ? Number(child.sortOrder) : childIndex + 1,
          };
        }),
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PARENT') {
      return NextResponse.json({ error: '阶段和项目活动名称为必填项' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_CHILD') {
      return NextResponse.json({ error: '子任务名称和责任角色为必填项' }, { status: 400 });
    }
    throw error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingParents = await tx.projectActivityParent.findMany({
        where: { projectId },
        include: { children: { select: { id: true, parentId: true } } },
      });
      const existingParentIds = new Set(existingParents.map((parent) => parent.id));
      const incomingParentIds = new Set(parents.map((parent) => parent.id).filter(Boolean));
      const invalidParentId = Array.from(incomingParentIds).find((parentId) => !existingParentIds.has(parentId));
      if (invalidParentId) throw new Error('INVALID_PARENT_ID');

      const resolveRoleId = await buildResponsibleRoleResolver(
        tx,
        parents.flatMap((parent) => parent.children),
      );

      await tx.projectActivityParent.deleteMany({
        where: { projectId, id: { notIn: Array.from(incomingParentIds) } },
      });

      for (const parent of parents) {
        const savedParent = parent.id
          ? await tx.projectActivityParent.update({
              where: { id: parent.id },
              data: {
                stage: parent.stage,
                projectTaskName: parent.projectTaskName,
                sortOrder: parent.sortOrder,
              },
              select: { id: true },
            })
          : await tx.projectActivityParent.create({
              data: {
                projectId,
                stage: parent.stage,
                projectTaskName: parent.projectTaskName,
                sortOrder: parent.sortOrder,
              },
              select: { id: true },
            });

        const existingChildren = existingParents.find((item) => item.id === savedParent.id)?.children ?? [];
        const existingChildIds = new Set(existingChildren.map((child) => child.id));
        const incomingChildIds = new Set(parent.children.map((child) => child.id).filter(Boolean));
        const invalidChildId = Array.from(incomingChildIds).find((childId) => !existingChildIds.has(childId));
        if (invalidChildId) throw new Error('INVALID_CHILD_ID');

        await tx.projectActivityChild.deleteMany({
          where: { parentId: savedParent.id, id: { notIn: Array.from(incomingChildIds) } },
        });

        for (const child of parent.children) {
          const childData = {
            thirdLevelPlan: child.thirdLevelPlan,
            ownerRole: child.ownerRole,
            roleGroup: child.roleGroup,
            responsibleRoleId: resolveRoleId(child),
            requiresDeliverable: child.requiresDeliverable,
            requiresAttachment: child.requiresDeliverable,
            requiresNote: !child.requiresDeliverable,
            deliverableName: child.deliverableName,
            sortOrder: child.sortOrder,
          };
          if (child.id) {
            await tx.projectActivityChild.update({
              where: { id: child.id },
              data: childData,
            });
          } else {
            await tx.projectActivityChild.create({
              data: {
                projectId,
                parentId: savedParent.id,
                ...childData,
                isManuallyAdded: true,
              },
            });
          }
        }
        await refreshParentSummary(tx, savedParent.id);
      }

      await tx.activityEvent.create({
        data: {
          projectId,
          actorUserId: r.session.sub,
          actorRole: r.access.kind === 'admin' ? 'admin' : 'NPQ',
          actionType: 'admin_activity_structure_save',
          note: cleanOptional(body.changeNote) ?? '后台项目活动结构维护',
        },
      });
    });

    return NextResponse.json({ parents: await getProjectActivities(projectId) });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PARENT') {
      return NextResponse.json({ error: '阶段和项目活动名称为必填项' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_CHILD') {
      return NextResponse.json({ error: '子任务名称和责任角色为必填项' }, { status: 400 });
    }
    if (error instanceof Error && (error.message === 'INVALID_PARENT_ID' || error.message === 'INVALID_CHILD_ID')) {
      return NextResponse.json({ error: '项目活动数据已变化，请刷新后重试' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '同一项目下阶段/项目活动/子任务名称存在重复' }, { status: 409 });
    }
    console.error('[admin/projects/[id]/activities:PUT]', error);
    return NextResponse.json({ error: '保存项目活动失败' }, { status: 500 });
  }
}
