import os from 'node:os';
import { enqueueExternalJob, claimExternalJobs, markExternalJobFailed, markExternalJobSucceeded, retryDelayForAttempt, type ExternalJob } from '@/lib/external-jobs';
import { onResourcePublishedNotify } from '@/lib/dingtalk/notify-review';
import { createDwsCli, type DwsCli } from './cli';
import { syncDwsDirectory, DwsDirectorySyncError } from './directory-sync';
import { recordDwsWorkerHeartbeat } from './status';
import {
  DwsNotificationError,
  processReworkHandled,
  processResourceBroadcast,
  processReviewResolved,
  processReviewSubmitted,
  processTestNotification,
  processTestTodo,
  processTestTodoComplete,
  type ResourceBroadcastPayload,
} from './notifications';

export function defaultWorkerId() {
  return process.env.DWS_WORKER_ID?.trim() || `${os.hostname()}:${process.pid}`;
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function booleanPayload(payload: Record<string, unknown>, key: string, fallback = false) {
  const value = payload[key];
  return typeof value === 'boolean' ? value : fallback;
}

function resourcePayload(payload: Record<string, unknown>): ResourceBroadcastPayload {
  const kind = payload.kind === 'CREATE' || payload.kind === 'UPDATE' ? payload.kind : null;
  const resourceId = stringPayload(payload, 'resourceId');
  const name = stringPayload(payload, 'name');
  const actorName = stringPayload(payload, 'actorName');
  if (!kind || !resourceId || !name || !actorName) {
    throw new DwsNotificationError('资源广播任务 payload 不完整', { retryable: false });
  }
  return {
    kind,
    resourceId,
    name,
    actorName,
    summary: stringPayload(payload, 'summary'),
    type: stringPayload(payload, 'type'),
    ownerName: stringPayload(payload, 'ownerName'),
    tags: stringPayload(payload, 'tags'),
    updateSummary: stringPayload(payload, 'updateSummary'),
  };
}

export async function processExternalJob(job: ExternalJob, cli: DwsCli = createDwsCli()) {
  const reviewId = stringPayload(job.payload, 'reviewId');
  switch (job.kind) {
    case 'directory.sync':
      return syncDwsDirectory(cli);
    case 'notification.review.submitted':
      if (!reviewId) throw new DwsNotificationError('审批通知缺少 reviewId', { retryable: false });
      return processReviewSubmitted(reviewId, job.id, cli);
    case 'notification.review.resolved':
      if (!reviewId) throw new DwsNotificationError('审批结果通知缺少 reviewId', { retryable: false });
      {
        const result = await processReviewResolved(
          reviewId,
          booleanPayload(job.payload, 'publish', true),
          job.id,
          cli,
        );
        if (booleanPayload(job.payload, 'publish', true)) {
          const publish = await onResourcePublishedNotify(reviewId);
          return { ...result, publish };
        }
        return result;
      }
    case 'notification.review.rework-handled':
      if (!reviewId) throw new DwsNotificationError('返工通知缺少 reviewId', { retryable: false });
      return processReworkHandled(reviewId, cli);
    case 'notification.resource.broadcast':
      return processResourceBroadcast(resourcePayload(job.payload), job.id, cli);
    case 'notification.test': {
      const localUserId = stringPayload(job.payload, 'localUserId');
      const category = stringPayload(job.payload, 'category');
      const path = stringPayload(job.payload, 'path') ?? '/ai-resources/admin/notifications';
      if (!localUserId || !category) {
        throw new DwsNotificationError('测试通知任务 payload 不完整', { retryable: false });
      }
      return processTestNotification(
        { localUserId, category: category as never, path },
        job.id,
        cli,
      );
    }
    case 'todo.test': {
      const localUserId = stringPayload(job.payload, 'localUserId');
      const category = stringPayload(job.payload, 'category');
      const path = stringPayload(job.payload, 'path') ?? '/ai-resources/admin/notifications';
      if (!localUserId || !category) {
        throw new DwsNotificationError('测试待办任务 payload 不完整', { retryable: false });
      }
      return processTestTodo(
        { localUserId, category: category as never, path },
        job.id,
        cli,
      );
    }
    case 'todo.test-complete': {
      const taskId = stringPayload(job.payload, 'taskId');
      if (!taskId) {
        throw new DwsNotificationError('测试完成待办任务缺少 taskId', { retryable: false });
      }
      return processTestTodoComplete({ taskId }, cli);
    }
    default:
      throw new DwsNotificationError(`不支持的外部任务类型：${job.kind}`, { retryable: false });
  }
}

export async function runDwsWorkerOnce(input: {
  workerId?: string;
  limit?: number;
  cli?: DwsCli;
} = {}) {
  const workerId = input.workerId ?? defaultWorkerId();
  const cli = input.cli ?? createDwsCli();
  const jobs = await claimExternalJobs({ workerId, limit: input.limit });
  const results = await Promise.allSettled(jobs.map(async (job) => {
    try {
      const result = await processExternalJob(job, cli);
      await markExternalJobSucceeded(job.id, workerId, {
        result: result && typeof result === 'object' ? result as Record<string, unknown> : {},
      });
      return { id: job.id, status: 'succeeded' as const };
    } catch (error) {
      const retryable =
        (error instanceof DwsNotificationError || error instanceof DwsDirectorySyncError)
          ? error.retryable
          : (error as { retryable?: unknown })?.retryable !== false;
      const maxAttempts = Math.max(1, Number(process.env.DWS_MAX_ATTEMPTS ?? 5));
      const shouldRetry = retryable && job.attempts < maxAttempts;
      await markExternalJobFailed({
        id: job.id,
        workerId,
        error,
        retryable: shouldRetry,
        retryAt: shouldRetry
          ? new Date(Date.now() + retryDelayForAttempt(job.attempts))
          : undefined,
      });
      return {
        id: job.id,
        status: shouldRetry ? 'retrying' as const : 'failed' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));
  const summary = {
    workerId,
    claimed: jobs.length,
    results: results.map((result) => result.status === 'fulfilled'
      ? result.value
      : { status: 'failed' as const, error: String(result.reason) }),
  };
  await recordDwsWorkerHeartbeat({
    workerId,
    pendingJobs: jobs.length,
    failedJobs: summary.results.filter((result) => result.status === 'failed').length,
  });
  return summary;
}

export async function runDwsWorkerLoop() {
  const intervalMs = Math.max(1_000, Number(process.env.DWS_WORKER_INTERVAL_MS ?? 5_000));
  const workerId = defaultWorkerId();
  const once = process.env.DWS_WORKER_ONCE === 'true';
  do {
    const result = await runDwsWorkerOnce({ workerId });
    console.info('[dws-worker] cycle complete', result);
    if (once) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

export async function enqueueDirectorySync(actorId: string, actorUsername: string) {
  return enqueueExternalJob({
    kind: 'directory.sync',
    idempotencyKey: `directory.sync:${Date.now()}:${actorId}`,
    payload: { actorId, actorUsername },
  });
}
