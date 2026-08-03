import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getSession } from '@/platform/auth/auth.config';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const positions = await db.positionRole.findMany({
    where: { isActive: true },
    select: { id: true, name: true, roleName: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(positions);
}
