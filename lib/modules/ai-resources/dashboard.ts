import { db } from '@/lib/database';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

export type AiResourceDashboard = Awaited<ReturnType<typeof getAiResourceDashboard>>;

export async function getAiResourceDashboard(requestedDays?: number) {
  const days = clampDays(requestedDays);
  const start = startOfUtcDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const [
    totalResources,
    draftResources,
    publishedResources,
    archivedResources,
    pendingReviews,
    rejectedReviews,
    approvedReviews,
    updateLogs,
    totalViewAggregate,
    topResources,
    pendingReviewItems,
  ] = await Promise.all([
    db.aiResource.count(),
    db.aiResource.count({ where: { status: 'DRAFT' } }),
    db.aiResource.count({ where: { status: 'PUBLISHED' } }),
    db.aiResource.count({ where: { status: 'ARCHIVED' } }),
    db.aiResourceReviewRequest.count({ where: { status: 'PENDING' } }),
    db.aiResourceReviewRequest.count({ where: { status: 'REJECTED' } }),
    db.aiResourceReviewRequest.count({ where: { status: 'APPROVED' } }),
    db.aiResourceUpdateLog.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'asc' },
      select: { action: true, result: true, createdAt: true },
    }),
    db.aiResource.aggregate({ _sum: { viewCount: true } }),
    db.aiResource.findMany({
      orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        viewCount: true,
        ownerName: true,
        updatedAt: true,
      },
    }),
    db.aiResourceReviewRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        id: true,
        type: true,
        createdAt: true,
        requester: { select: { username: true } },
        reviewer: { select: { username: true } },
        resource: { select: { id: true, name: true } },
      },
    }),
  ]);

  const trend = buildTrend(start, days, updateLogs);

  return {
    days,
    summary: {
      totalResources,
      draftResources,
      publishedResources,
      archivedResources,
      totalViews: Number(totalViewAggregate?._sum?.viewCount ?? 0),
      pendingReviews,
      rejectedReviews,
      approvedReviews,
    },
    trend,
    topResources,
    pendingReviewItems,
  };
}

function clampDays(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.min(Math.max(Math.trunc(value as number), 7), MAX_DAYS);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildTrend(
  start: Date,
  days: number,
  logs: Array<{ action: string; result: string; createdAt: Date }>,
) {
  const byDate = new Map<string, { created: number; updated: number; approved: number }>();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    byDate.set(toDateKey(date), { created: 0, updated: 0, approved: 0 });
  }

  for (const log of logs) {
    const bucket = byDate.get(toDateKey(new Date(log.createdAt)));
    if (!bucket) continue;
    if (log.action === 'CREATE') bucket.created += 1;
    else bucket.updated += 1;
    if (log.result === 'APPROVED' || log.result === 'DONE') bucket.approved += 1;
  }

  return Array.from(byDate, ([date, values]) => ({ date, ...values }));
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
