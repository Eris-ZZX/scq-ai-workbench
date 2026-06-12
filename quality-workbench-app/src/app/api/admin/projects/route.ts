import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { ensureProjectActivities } from '@/lib/db/activities';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

const validStatuses = new Set(['active', 'completed', 'paused']);
const projectRoleNames = ['NPQ', 'PQE', 'SQE', 'FAE', 'RAM', 'QCM'] as const;
type ProjectRoleName = (typeof projectRoleNames)[number];

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true, session };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptional(value: unknown) {
  const text = clean(value);
  return text || null;
}

function cleanUserIds(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => clean(item)).filter(Boolean)))
    : [];
}

function isProjectRoleName(value: string): value is ProjectRoleName {
  return projectRoleNames.includes(value as ProjectRoleName);
}

function projectSelect() {
  return {
    id: true,
    name: true,
    description: true,
    status: true,
    currentStage: true,
    createdAt: true,
    updatedAt: true,
    members: {
      orderBy: { createdAt: 'asc' as const },
      select: {
        id: true,
        userId: true,
        role: true,
        user: {
          select: {
            id: true,
            username: true,
            positionBinding: {
              select: {
                positionRoleId: true,
                positionRole: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    },
    _count: { select: { tasks: true, activityParents: true, activityChildren: true } },
  };
}

async function getProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    select: projectSelect(),
  });
}

async function getActivePositionRole(roleName: string) {
  return prisma.positionRole.findFirst({
    where: { OR: [{ code: roleName }, { name: roleName }], isActive: true },
    select: { id: true },
  });
}

async function validateRoleUsers(roleName: string, userIds: string[]) {
  const positionRole = await getActivePositionRole(roleName);
  if (!positionRole) return { error: `角色 ${roleName} 未启用或不存在` as const };

  const selectedUsers = userIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: userIds },
          status: 'active',
          positionBinding: { positionRoleId: positionRole.id },
        },
        select: { id: true },
      })
    : [];
  if (selectedUsers.length !== userIds.length) {
    return { error: `请选择启用状态且岗位为 ${roleName} 的用户` as const };
  }

  return { positionRole };
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(await getProjects());
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

  const name = clean(body.name);
  const description = cleanOptional(body.description);
  const status = validStatuses.has(clean(body.status)) ? clean(body.status) : 'active';
  const currentStage = clean(body.currentStage) || 'TR1';
  const ownerId = clean(body.ownerId);
  const activityTemplateSetId = clean(body.activityTemplateSetId);
  if (!name) return NextResponse.json({ error: '请填写项目名称' }, { status: 400 });
  const selectedTemplate = activityTemplateSetId
    ? await prisma.activityTemplateSet.findFirst({
        where: { id: activityTemplateSetId, isActive: true, latestPublishedVersionId: { not: null } },
        select: { id: true },
      })
    : null;
  if (activityTemplateSetId && !selectedTemplate) {
    return NextResponse.json({ error: '请选择启用且已有最新版本的活动模板' }, { status: 400 });
  }
  const initialNpqRole = ownerId
    ? await prisma.positionRole.findFirst({
        where: { OR: [{ code: 'NPQ' }, { name: 'NPQ' }], isActive: true },
        select: { id: true },
      })
    : null;
  const initialNpqUser = ownerId && initialNpqRole
    ? await prisma.user.findFirst({
        where: { id: ownerId, status: 'active', positionBinding: { positionRoleId: initialNpqRole.id } },
        select: { id: true },
      })
    : null;
  if (ownerId && (!initialNpqRole || !initialNpqUser)) {
    return NextResponse.json({ error: '初始 NPQ 成员必须是启用状态且岗位为 NPQ 的用户' }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { name, description, status, currentStage },
        select: { id: true },
      });
      if (ownerId) {
        await tx.projectMember.create({
          data: { projectId: project.id, userId: ownerId, role: 'owner' },
        });
      }
      return project;
    });
    if (activityTemplateSetId) {
      await ensureProjectActivities(created.id, r.session.sub, activityTemplateSetId);
    }
    const project = await prisma.project.findUnique({ where: { id: created.id }, select: projectSelect() });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: '项目负责人不存在' }, { status: 400 });
    }
    console.error('[admin/projects:POST]', error);
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
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

  const action = clean(body.action) || 'updateProject';
  const projectId = clean(body.projectId);
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });

  try {
    if (action === 'updateProject') {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ error: '请填写项目名称' }, { status: 400 });
      const status = clean(body.status);
      await prisma.project.update({
        where: { id: projectId },
        data: {
          name,
          description: cleanOptional(body.description),
          status: validStatuses.has(status) ? status : 'active',
          currentStage: clean(body.currentStage) || 'TR1',
        },
      });
    }

    if (action === 'syncRoleMembers') {
      const roleName = clean(body.roleName);
      const userIds = cleanUserIds(body.userIds);
      if (!isProjectRoleName(roleName)) {
        return NextResponse.json({ error: '项目成员只支持 NPQ、PQE、SQE、FAE、RAM、QCM 六类角色' }, { status: 400 });
      }
      const positionRole = await prisma.positionRole.findFirst({
        where: { OR: [{ code: roleName }, { name: roleName }], isActive: true },
        select: { id: true },
      });
      if (!positionRole) return NextResponse.json({ error: `角色 ${roleName} 未启用或不存在` }, { status: 400 });

      const selectedUsers = userIds.length > 0
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds },
              status: 'active',
              positionBinding: { positionRoleId: positionRole.id },
            },
            select: { id: true },
          })
        : [];
      if (selectedUsers.length !== userIds.length) {
        return NextResponse.json({ error: `请选择启用状态且岗位为 ${roleName} 的用户` }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        const existingMembers = await tx.projectMember.findMany({
          where: {
            projectId,
            user: { positionBinding: { positionRoleId: positionRole.id } },
          },
          select: { userId: true },
        });
        const selectedSet = new Set(userIds);
        const removedUserIds = existingMembers.map((item) => item.userId).filter((userId) => !selectedSet.has(userId));
        if (removedUserIds.length > 0) {
          await tx.projectMember.deleteMany({ where: { projectId, userId: { in: removedUserIds } } });
        }
        await tx.projectPositionAssignment.deleteMany({ where: { projectId, positionRoleId: positionRole.id } });

        for (const userId of userIds) {
          await tx.projectMember.upsert({
            where: { projectId_userId: { projectId, userId } },
            create: { projectId, userId, role: roleName === 'NPQ' ? 'owner' : 'member' },
            update: { role: roleName === 'NPQ' ? 'owner' : 'member' },
          });
        }
      });
    }

    if (action === 'addRoleMembers') {
      const roleName = clean(body.roleName);
      const userIds = cleanUserIds(body.userIds);
      if (!isProjectRoleName(roleName)) {
        return NextResponse.json({ error: '项目成员只支持 NPQ、PQE、SQE、FAE、RAM、QCM 六类角色' }, { status: 400 });
      }
      const validation = await validateRoleUsers(roleName, userIds);
      if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

      if (userIds.length > 0) {
        await prisma.$transaction(async (tx) => {
          const existingMembers = await tx.projectMember.findMany({
            where: { projectId, userId: { in: userIds } },
            select: { userId: true },
          });
          const existingUserIds = new Set(existingMembers.map((member) => member.userId));
          const missingUserIds = userIds.filter((userId) => !existingUserIds.has(userId));
          if (missingUserIds.length > 0) {
            await tx.projectMember.createMany({
              data: missingUserIds.map((userId) => ({
                projectId,
                userId,
                role: roleName === 'NPQ' ? 'owner' : 'member',
              })),
            });
          }
          await tx.projectMember.updateMany({
            where: { projectId, userId: { in: userIds } },
            data: { role: roleName === 'NPQ' ? 'owner' : 'member' },
          });
        });
      }
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: projectSelect() });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: '引用的用户或角色不存在' }, { status: 400 });
    }
    console.error('[admin/projects:PATCH]', error);
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const id = clean(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    console.error('[admin/projects:DELETE]', error);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
