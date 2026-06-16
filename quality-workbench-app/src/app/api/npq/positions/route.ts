import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const positions = await prisma.positionRole.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, roleName: true, roleGroup: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  return NextResponse.json(positions);
}
