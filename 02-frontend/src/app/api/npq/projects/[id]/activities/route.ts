// GET/POST /api/npq/projects/[id]/activities — F2 项目活动实例
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById } from '@/lib/db/projects';
import {
  canAccessProject,
  ensureProjectActivities,
  getActivityEvents,
  getProjectActivityView,
} from '@/lib/db/activities';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const allowed = await canAccessProject(id, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const project = await getProjectById(id, session.sub);
  const parents = await getProjectActivityView(id);
  const events = await getActivityEvents(id);
  return NextResponse.json({ project, parents, events });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const allowed = await canAccessProject(id, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const result = await ensureProjectActivities(id, session.sub);
  return NextResponse.json(result);
}
