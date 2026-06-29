// PATCH /api/npq/activities/parents/[id] — F2 项目活动计划时间 / NPQ 关闭
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { updateActivityParent } from '@/lib/db/activities';
import { isProjectOwner } from '@/lib/db/npq-permissions';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;

  const parent = await prisma.projectActivityParent.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!parent) return NextResponse.json({ error: '项目活动不存在' }, { status: 404 });

  let body: { plannedStartDate?: string | null; plannedDueDate?: string | null; close?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const allowed = await isProjectOwner(session.sub, parent.projectId);
  if (!allowed) return NextResponse.json({ error: '无权维护项目活动' }, { status: 403 });

  try {
    const updated = await updateActivityParent({
      parentId: id,
      actorUserId: session.sub,
      plannedStartDate: body.plannedStartDate,
      plannedDueDate: body.plannedDueDate,
      close: body.close,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'PARENT_CHILDREN_NOT_COMPLETED') {
      return NextResponse.json({ error: '全部子任务完成后才能关闭项目活动' }, { status: 422 });
    }
    console.error('[PATCH activity parent]', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
