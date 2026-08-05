import { db, type DatabaseClient } from '@/lib/database';
import { getTracer } from '@/platform/observability/tracer';

const SENSITIVE_KEY = /password|token|secret|content|extractedtext|attachment|resourceurl/i;
const MAX_STRING_LENGTH = 500;

export const AI_RESOURCE_AUDIT_ACTIONS = {
  RESOURCE_CREATE: 'resource.create',
  RESOURCE_UPDATE: 'resource.update',
  RESOURCE_ARCHIVE: 'resource.archive',
  RESOURCE_RESTORE: 'resource.restore',
  REVIEW_SUBMIT: 'review.submit',
  REVIEW_RESUBMIT: 'review.resubmit',
  REVIEW_APPROVE: 'review.approve',
  REVIEW_REJECT: 'review.reject',
  REVIEW_DISCARD: 'review.discard',
  RESOURCE_IMPORT: 'resource.import',
  PERMISSION_UPDATE: 'permission.update',
  DINGTALK_SETTINGS_UPDATE: 'dingtalk.settings.update',
  DINGTALK_TEST: 'dingtalk.test',
} as const;

export type AiResourceAuditInput = {
  actorId?: string | null;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  resourceId?: string | null;
  reviewId?: string | null;
  result: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  traceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AiResourceAuditQuery = {
  actorId?: string;
  actorUsername?: string;
  action?: string;
  targetType?: string;
  resourceId?: string;
  result?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
};

export async function appendAiResourceAuditLog(
  input: AiResourceAuditInput,
  tx: DatabaseClient = db,
) {
  return tx.aiResourceAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorUsernameSnapshot: input.actorUsername.trim() || 'system',
      action: input.action,
      module: 'AI_RESOURCE',
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      resourceId: input.resourceId ?? null,
      reviewId: input.reviewId ?? null,
      result: input.result,
      reason: sanitizeString(input.reason),
      beforeData: serializeAuditData(input.before),
      afterData: serializeAuditData(input.after),
      traceId: input.traceId ?? getTracer().currentTraceId,
      ipAddress: input.ipAddress ?? null,
      userAgent: sanitizeString(input.userAgent),
    },
  });
}

export function getAuditRequestContext(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    traceId: request.headers.get('x-trace-id') ?? getTracer().currentTraceId,
    ipAddress: forwardedFor || request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  };
}

export function summarizeResource(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    status: value.status,
    ownerId: value.ownerId,
    ownerName: value.ownerName,
    visibilityScope: value.visibilityScope,
    tags: value.tags,
    currentVersion: value.currentVersion,
    viewCount: value.viewCount,
  };
}

export async function getAiResourceAuditLogs(params: AiResourceAuditQuery = {}) {
  const where: Record<string, unknown> = {};
  if (params.actorId) where.actorId = params.actorId;
  if (params.actorUsername) where.actorUsernameSnapshot = { contains: params.actorUsername };
  if (params.action) where.action = params.action;
  if (params.targetType) where.targetType = params.targetType;
  if (params.resourceId) where.resourceId = params.resourceId;
  if (params.result) where.result = params.result;
  if (params.start || params.end) {
    where.createdAt = {};
    if (params.start) (where.createdAt as Record<string, unknown>).gte = new Date(params.start);
    if (params.end) (where.createdAt as Record<string, unknown>).lte = new Date(params.end);
  }

  const limit = clampInt(params.limit, 50, 1, 200);
  const offset = clampInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const [total, items] = await Promise.all([
    db.aiResourceAuditLog.count({ where }),
    db.aiResourceAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ]);

  return { items, total, limit, offset };
}

function serializeAuditData(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(sanitizeAuditValue(value));
  } catch {
    return JSON.stringify({ value: '[unserializable]' });
  }
}

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…`
    : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[redacted]' : sanitizeAuditValue(item, depth + 1)]),
    );
  }
  return String(value);
}

function sanitizeString(value: string | null | undefined) {
  if (!value) return null;
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value as number), min), max);
}
