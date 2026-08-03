// GET/POST /api/npq/tasks (F4)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById } from '@/lib/db/projects';
import { getTasksByProject, createTask } from '@/lib/db/tasks';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: '请指定 projectId' }, { status: 400 });

  try {
    const tasks = await getTasksByProject(projectId, session.sub);
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    title?: string; description?: string; priority?: string;
    projectId?: string; stageId?: string; assigneeMemberId?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body.title?.trim() || !body.projectId) {
    return NextResponse.json({ error: '标题和项目ID为必填项' }, { status: 400 });
  }
  if (body.title.length > 500) return NextResponse.json({ error: '标题不超过 500 字符' }, { status: 400 });

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (body.priority && !validPriorities.includes(body.priority)) {
    return NextResponse.json({ error: '无效的优先级' }, { status: 400 });
  }

  const project = await getProjectById(body.projectId, session.sub);
  if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

  try {
    const task = await createTask({
      title: body.title.trim(),
      description: body.description?.trim(),
      priority: body.priority,
      projectId: body.projectId,
      stageId: body.stageId,
      assigneeMemberId: body.assigneeMemberId,
      creatorId: session.sub,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'INVALID_ASSIGNEE') return NextResponse.json({ error: '执行者不是项目成员' }, { status: 400 });
      if (e.message === 'INVALID_STAGE') return NextResponse.json({ error: '阶段不属于该项目' }, { status: 400 });
    }
    console.error('[POST task]', e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
