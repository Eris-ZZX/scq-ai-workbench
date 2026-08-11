import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseAuthErrorParams } from '@/platform/auth/login-audit';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

const PAGE_SIZE = 20;
const PROVIDERS = ['authing', 'dingtalk', 'password'] as const;
const OUTCOMES = ['success', 'failure'] as const;

export async function GET(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const provider = url.searchParams.get('provider')?.trim() ?? '';
  const outcome = url.searchParams.get('outcome')?.trim() ?? '';
  const from = parseDate(url.searchParams.get('from'), false);
  const to = parseDate(url.searchParams.get('to'), true);
  const page = clampInt(url.searchParams.get('page'), 1, 1, 100000);

  const whereParts: Record<string, unknown>[] = [];
  if (PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    whereParts.push({ provider });
  }
  if (OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])) {
    whereParts.push({ outcome });
  }
  if (from || to) {
    whereParts.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }
  if (query) {
    whereParts.push({
      OR: [
        { username: { contains: query } },
        { displayName: { contains: query } },
        { errorCode: { contains: query } },
        { errorMessage: { contains: query } },
      ],
    });
  }

  const where = whereParts.length ? { AND: whereParts } : {};
  const [rows, total] = await Promise.all([
    db.authLoginLog.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.authLoginLog.count({ where }),
  ]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      stage: row.stage,
      outcome: row.outcome,
      username: row.username,
      displayName: row.displayName,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      errorParams: parseAuthErrorParams(row.errorParams),
      hasAuthingData: Boolean(row.authingData),
      createdAt: row.createdAt,
      user: row.user
        ? {
            id: row.user.id,
            username: row.user.username,
            displayName: row.user.displayName || row.user.username,
          }
        : null,
    })),
    filters: {
      providers: PROVIDERS,
      outcomes: OUTCOMES,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  });
}

function parseDate(value: string | null, endOfDay: boolean) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
