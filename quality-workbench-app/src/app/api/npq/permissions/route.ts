import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { canExecuteNpqAction } from '@/lib/db/npq-permissions';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const actions = (url.searchParams.get('actions') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const result: Record<string, boolean> = {};
  for (const actionKey of actions) {
    result[actionKey] = await canExecuteNpqAction({ actionKey, session, projectId });
  }

  return NextResponse.json(result);
}
