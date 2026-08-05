import { db } from '@/lib/database';

const DEFAULT_DAYS = 30;
const MIN_SHORTCUT_DAYS = 7;
const MAX_SHORTCUT_DAYS = 90;

export type AiResourceDashboardOptions = {
  days?: number | 'all' | null;
  start?: string;
  end?: string;
};

export type AiResourceDashboard = Awaited<ReturnType<typeof getAiResourceDashboard>>;

export async function getAiResourceDashboard(
  input: number | AiResourceDashboardOptions = DEFAULT_DAYS,
) {
  const range = resolveRange(input);

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
    totalUsers,
    activeUsers,
    disabledUsers,
    aiResourceMembers,
    activeUserProfiles,
  ] = await Promise.all([
    db.aiResource.count(),
    db.aiResource.count({ where: { status: 'DRAFT' } }),
    db.aiResource.count({ where: { status: 'PUBLISHED' } }),
    db.aiResource.count({ where: { status: 'ARCHIVED' } }),
    db.aiResourceReviewRequest.count({ where: { status: 'PENDING' } }),
    db.aiResourceReviewRequest.count({
      where: withDateRange({ status: 'REJECTED' }, range),
    }),
    db.aiResourceReviewRequest.count({
      where: withDateRange({ status: 'APPROVED' }, range),
    }),
    db.aiResourceUpdateLog.findMany({
      where: withDateRange({}, range),
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
    db.user.count(),
    db.user.count({ where: { status: 'active' } }),
    db.user.count({ where: { status: 'disabled' } }),
    db.aiResourceMembership.count({ where: { user: { status: 'active' } } }),
    db.user.findMany({
      where: { status: 'active' },
      select: {
        positionBinding: {
          select: { positionRole: { select: { name: true } } },
        },
        dingtalkDepartments: {
          where: { isPrimary: true },
          select: { department: { select: { name: true } } },
        },
      },
    }),
  ]);

  const trend = buildTrend(range, updateLogs);
  const userDistributions = buildUserDistributions(activeUserProfiles);

  return {
    days: range.days,
    range: {
      start: range.start ? toDateKey(range.start) : null,
      end: range.end ? toDateKey(range.end) : null,
      all: !range.start && !range.end,
    },
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
    userSummary: [
      { label: '全部用户', count: totalUsers },
      { label: '活跃用户', count: activeUsers },
      { label: '停用用户', count: disabledUsers },
      { label: 'AI资源库成员', count: aiResourceMembers },
    ],
    groupDistribution: userDistributions.groupDistribution,
    positionDistribution: userDistributions.positionDistribution,
  };
}

type DashboardRange = {
  start: Date | null;
  end: Date | null;
  days: number | null;
};

function resolveRange(input: number | AiResourceDashboardOptions): DashboardRange {
  if (typeof input === 'number') return shortcutRange(input);

  const startText = input.start?.trim();
  const endText = input.end?.trim();
  if (startText || endText) {
    const now = new Date();
    const start = startText
      ? parseDateBoundary(startText, false)
      : startOfUtcDay(new Date(now.getTime() - (DEFAULT_DAYS - 1) * 24 * 60 * 60 * 1000));
    const end = endText ? parseDateBoundary(endText, true) : endOfUtcDay(now);
    if (start && end && start <= end) {
      return {
        start,
        end,
        days: dateDistanceInDays(start, end),
      };
    }
  }

  if (input.days === 'all' || input.days === null) {
    return { start: null, end: null, days: null };
  }
  return shortcutRange(typeof input.days === 'number' ? input.days : DEFAULT_DAYS);
}

function shortcutRange(value?: number): DashboardRange {
  const days = clampDays(value);
  const end = endOfUtcDay(new Date());
  const start = startOfUtcDay(new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  return { start, end, days };
}

function clampDays(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.min(Math.max(Math.trunc(value as number), MIN_SHORTCUT_DAYS), MAX_SHORTCUT_DAYS);
}

function parseDateBoundary(value: string, endOfDay: boolean) {
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function dateDistanceInDays(start: Date, end: Date) {
  return Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function withDateRange(where: Record<string, unknown>, range: DashboardRange) {
  if (!range.start && !range.end) return where;
  return {
    ...where,
    createdAt: {
      ...(range.start ? { gte: range.start } : {}),
      ...(range.end ? { lte: range.end } : {}),
    },
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildTrend(
  range: DashboardRange,
  logs: Array<{ action: string; result: string; createdAt: Date }>,
) {
  if (!logs.length && !range.start) return [];
  const start = range.start ?? startOfUtcDay(new Date(Math.min(...logs.map((log) => new Date(log.createdAt).getTime()))));
  const end = range.end ?? endOfUtcDay(new Date(Math.max(...logs.map((log) => new Date(log.createdAt).getTime()))));
  const days = dateDistanceInDays(start, end);
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

function buildUserDistributions(
  profiles: Array<{
    positionBinding?: Array<{ positionRole?: { name?: string } | null }> | { positionRole?: { name?: string } | null } | null;
    dingtalkDepartments?: Array<{ department?: { name?: string } | null }>;
  }>,
) {
  const positionCounts = new Map<string, number>();
  const groupCounts = new Map<string, number>();

  for (const profile of profiles) {
    const bindings = Array.isArray(profile.positionBinding)
      ? profile.positionBinding
      : profile.positionBinding
        ? [profile.positionBinding]
        : [];
    const position = bindings[0]?.positionRole?.name || '未绑定岗位';
    positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1);

    const group = profile.dingtalkDepartments?.[0]?.department?.name || '未同步组织';
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }

  return {
    groupDistribution: sortDistribution(groupCounts),
    positionDistribution: sortDistribution(positionCounts),
  };
}

function sortDistribution(counts: Map<string, number>) {
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'));
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
