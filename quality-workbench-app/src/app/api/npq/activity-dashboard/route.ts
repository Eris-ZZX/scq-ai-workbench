// GET /api/npq/activity-dashboard — F2 管理层看板指标
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { canAccessProject, getActivityDashboard } from '@/lib/db/activities';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') || undefined;
  if (projectId) {
    const allowed = await canAccessProject(projectId, session.sub, session.role);
    if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const dashboard = await getActivityDashboard(projectId);
  return NextResponse.json(dashboard);
}
