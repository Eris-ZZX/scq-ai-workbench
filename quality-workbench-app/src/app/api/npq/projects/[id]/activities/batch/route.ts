import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { refreshParentSummary } from '@/lib/db/activities';
import { isProjectOwner } from '@/lib/db/npq-permissions';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: projectId } = await params;

  const allowed = await isProjectOwner(session.sub, projectId);
  if (!allowed) return NextResponse.json({ error: '无权批量维护活动' }, { status: 403 });

  let body: {
    childIds?: string[];
    status?: string;
    isNotApplicable?: boolean;
    notApplicableReason?: string | null;
    plannedDueDateOverride?: string | null;
    assigneeUserId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const childIds = Array.isArray(body.childIds) ? body.childIds.filter(Boolean) : [];
  if (childIds.length === 0) return NextResponse.json({ error: '请选择子任务' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.status) {
    if (!['not_started', 'in_progress', 'returned', 'completed'].includes(body.status)) {
      return NextResponse.json({ error: '无效状态' }, { status: 400 });
    }
    data.status = body.status;
    data.completedAt = body.status === 'completed' ? new Date() : null;
  }
  if (typeof body.isNotApplicable === 'boolean') {
    data.isNotApplicable = body.isNotApplicable;
    data.notApplicableReason = body.isNotApplicable ? body.notApplicableReason?.trim() || null : null;
    if (body.isNotApplicable) {
      data.status = 'not_started';
      data.completedAt = null;
      data.isBlocked = false;
    }
  }
  if ('plannedDueDateOverride' in body) {
    data.plannedDueDateOverride = parseDate(body.plannedDueDateOverride);
  }
  if ('assigneeUserId' in body) data.assigneeUserId = body.assigneeUserId || null;

  const result = await prisma.$transaction(async (tx) => {
    const update = await tx.projectActivityChild.updateMany({
      where: { projectId, id: { in: childIds } },
      data,
    });
    await tx.activityEvent.create({
      data: {
        projectId,
        actorUserId: session.sub,
        actorRole: 'NPQ',
        actionType: 'batch_update_children',
        afterValue: JSON.stringify({ childIds, data }),
      },
    });
    const parentIds = await tx.projectActivityChild.findMany({
      where: { projectId, id: { in: childIds } },
      select: { parentId: true },
      distinct: ['parentId'],
    });
    for (const { parentId } of parentIds) {
      await refreshParentSummary(tx, parentId);
    }
    return { count: update.count, parentIds: parentIds.map((item) => item.parentId) };
  });

  return NextResponse.json(result);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
