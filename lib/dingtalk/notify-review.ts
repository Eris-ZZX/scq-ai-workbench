import { createHash } from 'node:crypto';
import { db } from '@/lib/database';
import { enqueueExternalJob, type ExternalJob } from '@/lib/external-jobs';
import type { ExternalNotificationCategory } from './settings';

export type ResourceBroadcastInput = {
  kind: 'CREATE' | 'UPDATE';
  resourceId: string;
  name: string;
  summary?: string | null;
  type?: string | null;
  ownerName?: string | null;
  tags?: string | null;
  actorName: string;
  updateSummary?: string | null;
};

function payloadHash(payload: Record<string, unknown>) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 24);
}

function reviewJob(
  kind: string,
  reviewId: string,
  payload: Record<string, unknown> = {},
) {
  return enqueueExternalJob({
    kind,
    idempotencyKey: `${kind}:${reviewId}:${payloadHash(payload)}`,
    payload: { reviewId, ...payload },
  });
}

/**
 * Business routes await these functions. The event is therefore durable in
 * PostgreSQL before the HTTP request is considered successful; no request
 * lifecycle fire-and-forget work remains here.
 */
export function scheduleReviewSubmitted(reviewId: string): Promise<ExternalJob> {
  return reviewJob('notification.review.submitted', reviewId);
}

export function scheduleReviewResolved(
  reviewId: string,
  options?: { publish?: boolean },
): Promise<ExternalJob> {
  return reviewJob('notification.review.resolved', reviewId, {
    publish: options?.publish !== false,
  });
}

/** 提交人废弃/重新提交后，完成返工待办。 */
export function scheduleReworkHandled(reviewId: string): Promise<ExternalJob> {
  return reviewJob('notification.review.rework-handled', reviewId);
}

/** Backwards-compatible worker entry point; it now only enqueues durable work. */
export function onReviewSubmitted(reviewId: string) {
  return scheduleReviewSubmitted(reviewId);
}

export function onReviewResolved(reviewId: string, options?: { publish?: boolean }) {
  return scheduleReviewResolved(reviewId, options);
}

export function onReworkHandled(reviewId: string) {
  return scheduleReworkHandled(reviewId);
}

export function scheduleResourceBroadcast(input: ResourceBroadcastInput): Promise<ExternalJob> {
  const payload = { ...input } as Record<string, unknown>;
  return enqueueExternalJob({
    kind: 'notification.resource.broadcast',
    idempotencyKey: `notification.resource.broadcast:${input.resourceId}:${input.kind}:${payloadHash(payload)}`,
    payload,
  });
}

export async function notifyResourceBroadcast(input: ResourceBroadcastInput) {
  const job = await scheduleResourceBroadcast(input);
  return {
    enabled: true,
    sent: 0,
    queued: true,
    jobId: job.id,
    reason: 'queued',
  };
}

export async function onResourcePublishedNotify(reviewId: string) {
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          summary: true,
          type: true,
          ownerName: true,
          tags: true,
        },
      },
      requester: { select: { username: true } },
    },
  });
  if (!review || review.status !== 'APPROVED') {
    return { enabled: true, sent: 0, reason: 'not_approved' as const };
  }
  if (review.type !== 'CREATE' && review.type !== 'UPDATE') {
    return { enabled: true, sent: 0, reason: 'type_skipped' as const };
  }

  const resourceId = review.resourceId ?? review.resource?.id;
  if (!resourceId) return { enabled: true, sent: 0, reason: 'missing_resource' as const };

  let proposed: Record<string, unknown> = {};
  try {
    proposed = JSON.parse(review.proposedData) as Record<string, unknown>;
  } catch {
    // The review itself remains valid; the worker will use the stored fields.
  }

  return notifyResourceBroadcast({
    kind: review.type === 'CREATE' ? 'CREATE' : 'UPDATE',
    resourceId,
    name: review.resource?.name ?? String(proposed.name ?? '未命名资源'),
    summary: review.resource?.summary ?? String(proposed.summary ?? ''),
    type: review.resource?.type ?? String(proposed.type ?? ''),
    ownerName: review.resource?.ownerName ?? String(proposed.ownerName ?? ''),
    tags: review.resource?.tags ?? String(proposed.tags ?? ''),
    actorName: review.requester.username,
    updateSummary: review.type === 'UPDATE' ? review.updateSummary : undefined,
  });
}

export async function sendTestNotifyToUser(
  localUserId: string,
  category: ExternalNotificationCategory = 'publish',
): Promise<{ ok: boolean; error?: string; jobId?: string }> {
  try {
    const job = await enqueueExternalJob({
      kind: 'notification.test',
      idempotencyKey: `notification.test:${localUserId}:${category}:${Date.now()}`,
      payload: {
        localUserId,
        category,
        path: '/ai-resources/admin/notifications',
      },
    });
    return { ok: true, jobId: job.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '创建测试通知任务失败',
    };
  }
}
