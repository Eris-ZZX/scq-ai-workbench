import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      username: true,
      positionBinding: {
        select: {
          positionRoleId: true,
          positionRole: { select: { id: true, code: true, name: true, roleGroup: true } },
        },
      },
    },
    orderBy: { username: 'asc' },
  });
  return NextResponse.json(users);
}
