import crypto from 'node:crypto';
import { db, type DatabaseClient } from '@/lib/database';

export const NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 8;

export const NOTIFICATION_EVENT_TYPES = {
  reviewSubmitted: 'ai-resource.review-submitted',
  reviewResolved: 'ai-resource.review-resolved',
  reworkHandled: 'ai-resource.rework-handled',
  resourceBroadcast: 'ai-resource.resource-broadcast',
} as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[keyof typeof NOTIFICATION_EVENT_TYPES];

export type NotificationOutboxEvent = {
  eventType: NotificationEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type NotificationOutboxRow = {
  id: string;
  event_type: NotificationEventType;
  payload: string;
  idempotency_key: string;
  attempts: number;
};

export async function enqueueNotificationEvent(
  event: NotificationOutboxEvent,
  transaction: DatabaseClient = db,
) {
  await transaction.$queryRaw`
    INSERT INTO notification_outbox (
      id,
      event_type,
      payload,
      idempotency_key,
      status,
      attempts,
      available_at,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${event.eventType},
      ${JSON.stringify(event.payload)},
      ${event.idempotencyKey},
      'pending',
      0,
      now(),
      now(),
      now()
    )
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
}

export async function claimNotificationEvents(
  workerId: string,
  limit = 10,
): Promise<NotificationOutboxRow[]> {
  return db.$queryRaw<NotificationOutboxRow[]>`
    WITH next_events AS (
      SELECT id
      FROM notification_outbox
      WHERE (
        status = 'pending'
        OR (status = 'failed' AND available_at <= now())
        OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
      )
        AND available_at <= now()
        AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE notification_outbox AS outbox
    SET status = 'processing',
        attempts = outbox.attempts + 1,
        locked_at = now(),
        locked_by = ${workerId},
        updated_at = now()
    FROM next_events
    WHERE outbox.id = next_events.id
    RETURNING
      outbox.id,
      outbox.event_type,
      outbox.payload,
      outbox.idempotency_key,
      outbox.attempts
  `;
}

export async function completeNotificationEvent(eventId: string, workerId: string) {
  await db.$queryRaw`
    UPDATE notification_outbox
    SET status = 'completed',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now()
    WHERE id = ${eventId}
      AND status = 'processing'
      AND locked_by = ${workerId}
  `;
}

export async function failNotificationEvent(
  event: Pick<NotificationOutboxRow, 'id' | 'attempts'>,
  workerId: string,
  error: unknown,
) {
  const isDead = event.attempts >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS;
  const retryDelayMs = Math.min(15 * 60 * 1000, 2 ** Math.max(0, event.attempts - 1) * 1000);
  const availableAt = new Date(Date.now() + retryDelayMs);
  const lastError = error instanceof Error ? error.message : String(error);

  await db.$queryRaw`
    UPDATE notification_outbox
    SET status = ${isDead ? 'dead' : 'failed'},
        available_at = ${availableAt},
        locked_at = NULL,
        locked_by = NULL,
        last_error = ${lastError.slice(0, 2000)},
        updated_at = now()
    WHERE id = ${event.id}
      AND status = 'processing'
      AND locked_by = ${workerId}
  `;
}

export function parseNotificationPayload(payload: string): Record<string, unknown> {
  const value: unknown = JSON.parse(payload);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('通知 outbox payload 必须是 JSON 对象');
  }
  return value as Record<string, unknown>;
}
