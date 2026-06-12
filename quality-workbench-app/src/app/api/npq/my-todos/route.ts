import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { getEffectivePositionRoleIds } from '@/lib/db/npq-permissions';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const roleIds = await getEffectivePositionRoleIds(session);
  const roleIdsForProject = await prisma.projectPositionAssignment.findMany({
    where: { userId: session.sub },
    select: { projectId: true, positionRoleId: true },
  });
  const projectIds = roleIdsForProject.map((item) => item.projectId);
  const positionIds = Array.from(new Set([...roleIds.filter((id) => id !== '__admin__'), ...roleIdsForProject.map((item) => item.positionRoleId)]));
  const now = new Date();

  const children = await prisma.projectActivityChild.findMany({
    where: {
      isNotApplicable: false,
      status: { not: 'completed' },
      OR: [
        { assigneeUserId: session.sub },
        { responsibleRoleId: { in: positionIds } },
        { projectId: { in: projectIds } },
      ],
    },
    include: {
      project: { select: { id: true, name: true } },
      parent: { select: { id: true, stage: true, projectTaskName: true, plannedDueDate: true } },
      attachments: { where: { deletedAt: null }, select: { id: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
  });

  const childTodos = children.map((child) => {
    const due = child.plannedDueDateOverride ?? child.parent.plannedDueDate;
    const missingAttachment = child.requiresAttachment && child.attachments.length === 0;
    return {
      type: child.status === 'returned' ? 'returned' : due && due < now ? 'overdue' : missingAttachment ? 'missing_attachment' : 'responsibility',
      projectId: child.projectId,
      projectName: child.project.name,
      parentId: child.parentId,
      childId: child.id,
      stage: child.parent.stage,
      title: child.thirdLevelPlan,
      parentTitle: child.parent.projectTaskName,
      status: child.status,
      dueAt: due,
      missingAttachment,
    };
  });

  const pendingParents = await prisma.projectActivityParent.findMany({
    where: {
      status: 'pending_npq_close',
      project: session.role === 'admin' ? undefined : { positionAssignments: { some: { userId: session.sub, positionRole: { code: 'NPQ' } } } },
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: session.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    todos: [
      ...childTodos,
      ...pendingParents.map((parent) => ({
        type: 'pending_parent_close',
        projectId: parent.projectId,
        projectName: parent.project.name,
        parentId: parent.id,
        childId: null,
        stage: parent.stage,
        title: parent.projectTaskName,
        parentTitle: parent.projectTaskName,
        status: parent.status,
        dueAt: parent.plannedDueDate,
        missingAttachment: false,
      })),
    ],
    notifications,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { notificationId?: string };
  if (!body.notificationId) return NextResponse.json({ error: '缺少提醒 ID' }, { status: 400 });
  const updated = await prisma.notification.updateMany({
    where: { id: body.notificationId, recipientUserId: session.sub },
    data: { status: 'read', readAt: new Date() },
  });
  if (updated.count === 0) return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
