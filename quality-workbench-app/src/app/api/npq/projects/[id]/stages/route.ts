// GET/POST /api/npq/projects/[id]/stages (F3.S5)
// 🔧 S-1: Added project membership verification
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById, getStages, addStage } from '@/lib/db/projects';

async function checkMembership(projectId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  const project = await getProjectById(projectId, session.sub);
  if (!project) return { error: '项目不存在', status: 404 };
  return { session, project, status: 0 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(await getStages(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });

  let body: { name?: string; description?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: '阶段名称为必填项' }, { status: 400 });
  }
  if (body.name.length > 200) return NextResponse.json({ error: '阶段名称不超过 200 字符' }, { status: 400 });

  const stage = await addStage(id, { name: body.name.trim(), description: body.description?.trim() });
  return NextResponse.json(stage, { status: 201 });
}
