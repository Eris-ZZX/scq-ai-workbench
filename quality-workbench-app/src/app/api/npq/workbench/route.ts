import { NextResponse } from 'next/server';
import { getWorkbenchData } from '@/lib/db/workbench';
import { getSession } from '@/platform/auth/auth.config';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') ?? undefined;
  const data = await getWorkbenchData({
    sub: session.sub,
    username: session.username,
    role: session.role,
  }, { projectId });
  return NextResponse.json(data);
}
