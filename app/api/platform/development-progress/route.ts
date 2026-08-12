import { NextResponse } from 'next/server';
import { getDevelopmentProgress } from '@/lib/platform/development-progress';
import { requirePlatformPrincipalApi } from '@/platform/apps/access';

export async function GET() {
  const access = await requirePlatformPrincipalApi();
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json(await getDevelopmentProgress());
}
