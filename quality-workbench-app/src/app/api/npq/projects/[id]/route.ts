// GET/PATCH/DELETE /api/npq/projects/[id] — 项目详情/更新/删除 (F3.S4)
// 🔧 M-3: PATCH status 仅限 owner + 输入验证
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById, updateProject, deleteProject } from '@/lib/db/projects';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const project = await getProjectById(id, session.sub);
  if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;

  const project = await getProjectById(id, session.sub);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  const isOwner = project.members.some((m) => m.userId === session.sub && m.role === 'owner');

  let body: { name?: string; description?: string; status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  // 🔧 M-3: status 更改仅限 owner
  if (body.status && !isOwner) {
    return NextResponse.json({ error: '仅项目负责人可更改状态' }, { status: 403 });
  }
  // 🔧 H-2(static): name 输入验证
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) return NextResponse.json({ error: '项目名称不可为空' }, { status: 400 });
    if (trimmed.length > 200) return NextResponse.json({ error: '项目名称不超过 200 字符' }, { status: 400 });
    body.name = trimmed;
  }

  try {
    const updated = await updateProject(id, body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const project = await getProjectById(id, session.sub);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  const isOwner = project.members.some((m) => m.userId === session.sub && m.role === 'owner');
  if (!isOwner) return NextResponse.json({ error: '仅项目负责人可删除' }, { status: 403 });
  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
