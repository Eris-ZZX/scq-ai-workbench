import { NextResponse } from 'next/server';
import { getWorkbenchData } from '@/lib/db/workbench';
import { requirePlatformAppApi } from '@/platform/apps/access';

export async function GET(request: Request) {
  const access = await requirePlatformAppApi('npq');
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') ?? undefined;
  const data = await getWorkbenchData({
    sub: access.principal.sub,
    username: access.principal.username,
    displayName: access.principal.displayName,
    role: access.principal.role,
  }, { projectId });
  return NextResponse.json(data);
}
