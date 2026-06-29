import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { activateProjectStageActivities, ensureProjectActivities } from '@/lib/db/activities';
import { canManageProject, getProjectAdminAccess, projectScopeWhere, type ProjectAdminAccess } from '@/lib/db/project-admin-access';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

const validStatuses = new Set(['active', 'completed', 'paused']);

async function checkProjectManager() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 } as const;
  const access = await getProjectAdminAccess(session);
  if (access.kind === 'none') return { error: '无权访问项目管理', status: 403 } as const;
  return { ok: true, session, access } as const;
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
        assignedRole: true,
        user: {
          select: {
            id: true,
            username: true,
            positionBinding: {
              select: {
                positionRoleId: true,
                positionRole: { select: { id: true, name: true, roleName: true } },
              },
            },
          },
        },
      },
    },
    _count: { select: { tasks: true, activityParents: true, activityChildren: true } },
  };
}

async function getProjects(access: ProjectAdminAccess) {
  return prisma.project.findMany({
    where: projectScopeWhere(access),
    orderBy: { updatedAt: 'desc' },
    select: projectSelect(),
  });
}

export async function GET() {
  const r = await checkProjectManager();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(await getProjects(r.access));
}

export async function POST(request: Request) {
  const r = await checkProjectManager();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.access.kind !== 'admin') return NextResponse.json({ error: '仅管理员可以新增项目' }, { status: 403 });

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

  try {
    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { name, description, status, currentStage },
        select: { id: true },
      });
      if (ownerId) {
        await tx.projectMember.create({
          data: { projectId: project.id, userId: ownerId, role: 'owner', assignedRole: 'NPQ' },
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
  const r = await checkProjectManager();
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
  if (!(await canManageProject(r.access, projectId))) {
    return NextResponse.json({ error: '无权维护该项目' }, { status: 403 });
  }

  try {
    if (action === 'updateProject') {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ error: '请填写项目名称' }, { status: 400 });
      const status = clean(body.status);
      const currentStage = clean(body.currentStage) || 'TR1';
      await prisma.project.update({
        where: { id: projectId },
        data: {
          name,
          description: cleanOptional(body.description),
          status: validStatuses.has(status) ? status : 'active',
          currentStage,
        },
      });
      if (status !== 'completed') {
        await activateProjectStageActivities(projectId, currentStage, r.session.sub);
      }
    }

    if (action === 'addMembers') {
      const userIds = cleanUserIds(body.userIds);
      const roleName = clean(body.roleName);
      if (userIds.length > 0) {
        const activeUsers = userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds }, status: 'active' },
              select: { id: true },
            })
          : [];
        if (activeUsers.length !== userIds.length) {
          return NextResponse.json({ error: '请选择启用状态的用户' }, { status: 400 });
        }

        const isOwner = roleName === 'NPQ';

        await prisma.$transaction(async (tx) => {
          const existing = await tx.projectMember.findMany({
            where: { projectId, userId: { in: userIds } },
            select: { userId: true },
          });
          const existingSet = new Set(existing.map((m) => m.userId));
          const newUserIds = userIds.filter((uid) => !existingSet.has(uid));

          for (const userId of newUserIds) {
            await tx.projectMember.create({
              data: {
                projectId,
                userId,
                role: isOwner ? 'owner' : 'member',
                assignedRole: roleName || null,
              },
            });
          }
        });
      }
    }

    if (action === 'removeMember') {
      const userId = clean(body.userId);
      if (!userId) return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 });

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true, role: true },
      });
      if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 });

      // 防止移除最后一个 owner
      if (member.role === 'owner') {
        const ownerCount = await prisma.projectMember.count({
          where: { projectId, role: 'owner' },
        });
        if (ownerCount <= 1) {
          return NextResponse.json({ error: '不能移除最后一位项目负责人' }, { status: 400 });
        }
      }

      await prisma.projectMember.delete({ where: { id: member.id } });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: projectSelect() });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: '引用的用户不存在' }, { status: 400 });
    }
    console.error('[admin/projects:PATCH]', error);
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const r = await checkProjectManager();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.access.kind !== 'admin') return NextResponse.json({ error: '仅管理员可以删除项目' }, { status: 403 });

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
