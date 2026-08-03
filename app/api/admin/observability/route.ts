import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getEvents } from '@/platform/observability';
import { getUsageStats } from '@/platform/observability/metrics';

async function checkAccess() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '无权访问运行日志', status: 403 };
  return { ok: true, session };
}

export async function GET(request: Request) {
  const access = await checkAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type === 'stats') {
    const stats = await getUsageStats();
    return NextResponse.json(stats);
  }

  const events = await getEvents({
    traceId: searchParams.get('traceId') ?? undefined,
    eventType: searchParams.get('eventType') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    start: searchParams.get('start') ?? undefined,
    end: searchParams.get('end') ?? undefined,
    limit: clampInt(searchParams.get('limit'), 50, 1, 200),
    offset: clampInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER),
  });
  return NextResponse.json(events);
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
