// platform/observability/logger.ts — 结构化日志写入 (F6.S1)
import { prisma } from '@/lib/prisma';
import { getTracer } from './tracer';

type EventType = 'request' | 'db_query' | 'ai_call' | 'user_action' | 'error';

export async function logEvent(params: {
  traceId: string;
  eventType: EventType;
  path?: string;
  method?: string;
  userId?: string;
  projectId?: string;
  statusCode?: number;
  durationMs?: number;
  requestBody?: string;
  responseSummary?: string;
  errorMessage?: string;
  errorStack?: string;
}) {
  // Fire-and-forget: 不阻塞主请求
  prisma.observabilityEvent.create({
    data: { ...params, spanId: getTracer().currentSpanId, parentSpanId: getTracer().parentSpanId },
  }).catch(() => {/* silently fail — observability must not break app */});
}

export async function getEvents(params: {
  traceId?: string; eventType?: string; userId?: string; projectId?: string;
  start?: string; end?: string; limit?: number; offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.traceId) where.traceId = params.traceId;
  if (params.eventType) where.eventType = params.eventType;
  if (params.userId) where.userId = params.userId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.start || params.end) {
    where.timestamp = {};
    if (params.start) (where.timestamp as Record<string,unknown>).gte = new Date(params.start);
    if (params.end) (where.timestamp as Record<string,unknown>).lte = new Date(params.end);
  }
  return prisma.observabilityEvent.findMany({
    where, orderBy: { timestamp: 'desc' },
    take: Math.min(params.limit ?? 50, 200), skip: params.offset ?? 0,
  });
}
