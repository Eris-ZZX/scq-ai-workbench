import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getSession } from '@/platform/auth/auth.config';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const roles = await db.projectRole.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(roles);
}
