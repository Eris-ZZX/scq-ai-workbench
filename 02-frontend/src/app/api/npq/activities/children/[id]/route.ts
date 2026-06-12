// PATCH /api/npq/activities/children/[id] — F2 子任务更新与留痕
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { canAccessProject, getActivityEvents, updateActivityChild } from '@/lib/db/activities';
import { canMaintainActivityChild } from '@/lib/db/npq-permissions';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const child = await prisma.projectActivityChild.findUnique({
    where: { id },
    include: {
      parent: true,
      attachments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!child) return NextResponse.json({ error: '子任务不存在' }, { status: 404 });
  const allowed = await canAccessProject(child.projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const events = await getActivityEvents(child.projectId, child.id);
  return NextResponse.json({ ...child, events });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  let body: {
    status?: string;
    deliverableUrl?: string | null;
    completionNote?: string | null;
    blockerNote?: string | null;
    isBlocked?: boolean;
    plannedDueDateOverride?: string | null;
    returnReason?: string | null;
    isNotApplicable?: boolean;
    notApplicableReason?: string | null;
    assigneeUserId?: string | null;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const permission = await canMaintainActivityChild({
    session,
    childId: id,
    returnAction: Boolean(body.returnReason?.trim()),
  });
  if (!permission.child) return NextResponse.json({ error: '子任务不存在' }, { status: 404 });
  if (!permission.allowed) return NextResponse.json({ error: '无权维护该子任务' }, { status: 403 });

  try {
    const updated = await updateActivityChild({
      childId: id,
      actorUserId: session.sub,
      actorRole: session.role === 'admin' ? 'NPQ' : permission.child.ownerRole,
      status: body.status,
      deliverableUrl: body.deliverableUrl,
      completionNote: body.completionNote,
      blockerNote: body.blockerNote,
      isBlocked: body.isBlocked,
      plannedDueDateOverride: body.plannedDueDateOverride,
      returnReason: body.returnReason,
      isNotApplicable: body.isNotApplicable,
      notApplicableReason: body.notApplicableReason,
      assigneeUserId: body.assigneeUserId,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      const messageMap: Record<string, string> = {
        DELIVERABLE_REQUIRED: '需要交付件的子任务必须填写交付件链接/文件/说明',
        COMPLETION_NOTE_REQUIRED: '无需交付件的子任务必须填写完成说明或确认备注',
        INVALID_CHILD_STATUS: '无效的子任务状态',
      };
      if (messageMap[error.message]) {
        return NextResponse.json({ error: messageMap[error.message] }, { status: 422 });
      }
    }
    console.error('[PATCH activity child]', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
