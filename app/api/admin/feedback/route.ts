import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { FEEDBACK_APPLICATIONS } from '@/lib/feedback/constants';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const application = url.searchParams.get('application')?.trim() ?? '';
  const page = clampInt(url.searchParams.get('page'), 1, 1, 100000);
  const whereParts: Record<string, unknown>[] = [];

  if (application) whereParts.push({ application });
  if (query) {
    whereParts.push({
      OR: [
        { content: { contains: query } },
        { pagePath: { contains: query } },
        { user: { is: { username: { contains: query } } } },
        { user: { is: { displayName: { contains: query } } } },
      ],
    });
  }

  const where = whereParts.length ? { AND: whereParts } : {};
  const [rows, total] = await Promise.all([
    db.feedbackLog.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.feedbackLog.count({ where }),
  ]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      content: row.content,
      application: row.application,
      pagePath: row.pagePath,
      createdAt: row.createdAt,
      user: row.user
        ? {
            id: row.user.id,
            username: row.user.username,
            displayName: row.user.displayName || row.user.username,
          }
        : null,
      attachments: parseAttachments(row.attachments),
    })),
    filters: {
      applications: FEEDBACK_APPLICATIONS,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  });
}

function parseAttachments(value: unknown) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is {
      name: string;
      storedName: string;
      size: number;
      type: string;
    } => (
      item &&
      typeof item.name === 'string' &&
      typeof item.storedName === 'string' &&
      typeof item.size === 'number' &&
      typeof item.type === 'string'
    ));
  } catch {
    return [];
  }
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
