import crypto from 'node:crypto';
import os from 'node:os';
import {
  claimNotificationEvents,
  completeNotificationEvent,
  failNotificationEvent,
  parseNotificationPayload,
  type NotificationOutboxRow,
} from '@/platform/notifications/outbox';
import {
  notifyResourceBroadcast,
  onReviewResolved,
  onReviewSubmitted,
  onReworkHandled,
  type ResourceBroadcastInput,
} from '@/lib/dingtalk/notify-review';

const workerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
const batchSize = Math.min(50, Math.max(1, Number.parseInt(process.env.NOTIFICATION_WORKER_BATCH ?? '10', 10) || 10));
const pollIntervalMs = Math.max(500, Number.parseInt(process.env.NOTIFICATION_WORKER_POLL_MS ?? '2000', 10) || 2000);
let stopping = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`通知事件缺少字符串字段：${key}`);
  }
  return value;
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function resourceBroadcastInput(payload: Record<string, unknown>): ResourceBroadcastInput {
  const kind = payload.kind;
  if (kind !== 'CREATE' && kind !== 'UPDATE') {
    throw new Error('资源广播事件的 kind 无效');
  }
  return {
    kind,
    resourceId: requiredString(payload, 'resourceId'),
    name: requiredString(payload, 'name'),
    summary: nullableString(payload.summary),
    type: nullableString(payload.type),
    ownerName: nullableString(payload.ownerName),
    tags: nullableString(payload.tags),
    actorName: requiredString(payload, 'actorName'),
    updateSummary: nullableString(payload.updateSummary),
  };
}

async function dispatch(event: NotificationOutboxRow) {
  const payload = parseNotificationPayload(event.payload);
  switch (event.event_type) {
    case 'ai-resource.review-submitted':
      await onReviewSubmitted(requiredString(payload, 'reviewId'));
      return;
    case 'ai-resource.review-resolved':
      await onReviewResolved(requiredString(payload, 'reviewId'), {
        publish: payload.publish !== false,
      });
      return;
    case 'ai-resource.rework-handled':
      await onReworkHandled(requiredString(payload, 'reviewId'), {
        dingtalkReworkTodoId: nullableString(payload.dingtalkReworkTodoId),
        dingtalkReworkTodoUnionId: nullableString(payload.dingtalkReworkTodoUnionId),
      });
      return;
    case 'ai-resource.resource-broadcast':
      await notifyResourceBroadcast(resourceBroadcastInput(payload));
      return;
    default:
      throw new Error(`未知通知事件类型：${event.event_type}`);
  }
}

async function runOnce() {
  const events = await claimNotificationEvents(workerId, batchSize);
  if (events.length === 0) return false;

  for (const event of events) {
    try {
      await dispatch(event);
      await completeNotificationEvent(event.id, workerId);
      console.info(`[notification-worker] completed ${event.event_type} ${event.id}`);
    } catch (error) {
      console.error(`[notification-worker] failed ${event.event_type} ${event.id}:`, error);
      await failNotificationEvent(event, workerId, error);
    }
  }
  return true;
}

async function main() {
  console.info(`[notification-worker] started as ${workerId}`);
  while (!stopping) {
    const processed = await runOnce();
    if (!processed) await delay(pollIntervalMs);
  }
  console.info('[notification-worker] stopped');
}

process.once('SIGINT', () => {
  stopping = true;
});
process.once('SIGTERM', () => {
  stopping = true;
});

main().catch((error) => {
  console.error('[notification-worker] fatal error:', error);
  process.exitCode = 1;
});
