// platform/observability/metrics.ts — 使用情况统计 (F6.S6)
import { prisma } from '@/lib/prisma';

export async function getUsageStats() {
  const [totalRequests, todayRequests, errorCount, avgDuration] = await Promise.all([
    prisma.observabilityEvent.count({ where: { eventType: 'request' } }),
    prisma.observabilityEvent.count({
      where: { eventType: 'request', timestamp: { gte: new Date(Date.now() - 86400000) } },
    }),
    prisma.observabilityEvent.count({
      where: { eventType: 'error', timestamp: { gte: new Date(Date.now() - 86400000) } },
    }),
    prisma.observabilityEvent.aggregate({
      where: { eventType: 'request', durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
  ]);

  const p95Raw = await prisma.$queryRawUnsafe<[{ p95: number | null }]>(
    `SELECT durationMs AS p95 FROM ObservabilityEvent WHERE eventType='request' AND durationMs IS NOT NULL ORDER BY durationMs ASC LIMIT 1 OFFSET (SELECT CAST(COUNT(*)*0.95 AS INT) FROM ObservabilityEvent WHERE eventType='request' AND durationMs IS NOT NULL)`
  );
  const p95 = p95Raw?.[0]?.p95 ?? 0;

  return { totalRequests, todayRequests, todayErrors: errorCount, avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0), p95DurationMs: p95 };
}
