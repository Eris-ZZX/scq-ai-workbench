import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getSession } from '@/platform/auth/auth.config';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true, session };
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const positions = await db.positionRole.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      roleName: true,
      isActive: true,
      sortOrder: true,
      _count: {
        select: {
          userPositions: true,
          projectAssignments: true,
          templateChildren: true,
          activityChildren: true,
        },
      },
    },
  });
  return NextResponse.json(positions);
}

const READ_ONLY_ERROR = '岗位由 DWS 组织目录同步，不能手动新增、修改或删除。';

export async function POST() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
}

export async function PATCH() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
}

export async function DELETE() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
}
