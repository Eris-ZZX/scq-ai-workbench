// platform/observability/metrics.ts — 使用情况统计 (F6.S6)
import { db } from '@/lib/database';

export async function getUsageStats() {
  const [totalRequests, todayRequests, errorCount, avgDuration] = await Promise.all([
    db.observabilityEvent.count({ where: { eventType: 'request' } }),
    db.observabilityEvent.count({
      where: { eventType: 'request', timestamp: { gte: new Date(Date.now() - 86400000) } },
    }),
    db.observabilityEvent.count({
      where: { eventType: 'error', timestamp: { gte: new Date(Date.now() - 86400000) } },
    }),
    db.observabilityEvent.aggregate({
      where: { eventType: 'request', durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
  ]);

  const p95Raw = await db.$queryRawUnsafe<[{ p95: number | null }]>(
    `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
     FROM observability_events
     WHERE event_type = 'request' AND duration_ms IS NOT NULL`,
  );
  const p95 = p95Raw?.[0]?.p95 ?? 0;

  return { totalRequests, todayRequests, todayErrors: errorCount, avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0), p95DurationMs: p95 };
}
