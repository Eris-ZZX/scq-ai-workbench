// PATCH/DELETE /api/npq/tasks/[id] (F4.S3/S4)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getTaskById, updateTask, updateTaskStatus, deleteTask, getTaskHistory } from '@/lib/db/tasks';
import { getProjectById } from '@/lib/db/projects';
import { Prisma } from '@/generated/prisma/client';

async function checkTaskAccess(taskId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 } as const;
  const task = await getTaskById(taskId);
  if (!task) return { error: '任务不存在', status: 404 } as const;
  const project = await getProjectById(task.projectId, session.sub);
  if (!project) return { error: '无权访问', status: 403 } as const;
  return { ok: true, session, task, project } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await checkTaskAccess(id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const history = await getTaskHistory(id).catch(() => []);
  return NextResponse.json({ ...r.task, history });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await checkTaskAccess(id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { title?: string; description?: string; priority?: string; status?: string; stageId?: string | null; assigneeMemberId?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  // 🔧 PATCH title 验证
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    if (t.length > 500) return NextResponse.json({ error: '标题不超过 500 字符' }, { status: 400 });
    body.title = t;
  }
  // 🔧 priority 验证
  if (body.priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(body.priority)) return NextResponse.json({ error: '无效的优先级' }, { status: 400 });
  }

  // 🔧 F1: 状态变更走审计 + 转换验证
  if (body.status) {
    try {
      const task = await updateTaskStatus(id, body.status, r.session.sub);
      if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
      return NextResponse.json(task);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'TASK_NOT_FOUND') return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        if (e.message.startsWith('INVALID_TRANSITION:')) return NextResponse.json({ error: '不允许的状态切换', detail: e.message }, { status: 422 });
      }
      console.error('[PATCH task]', e);
      return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
  }

  // 🔧 R1: 非状态更新 try/catch
  try {
    const u = await updateTask(id, {
      title: body.title, description: body.description?.trim(),
      priority: body.priority, stageId: body.stageId, assigneeMemberId: body.assigneeMemberId,
    });
    if (!u) return NextResponse.json({ error: '更新失败（数据不一致）' }, { status: 409 });
    return NextResponse.json(u);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    console.error('[PATCH task]', e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await checkTaskAccess(id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  // 🔧 F2: 仅项目 owner 或任务创建者可删除
  const isOwner = r.project.members.some((m) => m.userId === r.session.sub && m.role === 'owner');
  const isCreator = r.task.creatorId === r.session.sub;
  if (!isOwner && !isCreator) {
    return NextResponse.json({ error: '仅项目负责人或任务创建者可删除' }, { status: 403 });
  }

  // 🔧 R1: try/catch
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    console.error('[DELETE task]', e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
