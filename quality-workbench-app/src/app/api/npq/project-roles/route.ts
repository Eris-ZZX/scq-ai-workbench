import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const roles = await prisma.projectRole.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(roles);
}
