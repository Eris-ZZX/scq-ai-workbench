// GET /api/npq/projects/[id]/members
// 项目成员维护已集中到后台项目管理，业务侧只保留只读查询。
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById, getMembers } from '@/lib/db/projects';

async function checkMembership(projectId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  const project = await getProjectById(projectId, session.sub);
  if (!project) return { error: '项目不存在', status: 404 };
  return { session, project, status: 0 };
}

function centralizedManagementResponse() {
  return NextResponse.json({ error: '项目成员请在后台项目管理维护' }, { status: 410 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });
  const members = await getMembers(id);
  return NextResponse.json(members);
}

export async function POST() {
  return centralizedManagementResponse();
}

export async function PATCH() {
  return centralizedManagementResponse();
}

export async function DELETE() {
  return centralizedManagementResponse();
}
