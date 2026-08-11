import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: { $queryRaw: mockQueryRaw },
}));

import {
  enqueueNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
  parseNotificationPayload,
} from '@/platform/notifications/outbox';

describe('notification outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it('enqueues an idempotent event with a serialized payload', async () => {
    await enqueueNotificationEvent({
      eventType: NOTIFICATION_EVENT_TYPES.reviewSubmitted,
      idempotencyKey: 'review-submitted:review-1',
      payload: { reviewId: 'review-1' },
    });

    expect(mockQueryRaw).toHaveBeenCalledOnce();
    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('')).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
    expect(values).toContain('review-submitted:review-1');
    expect(values).toContain(JSON.stringify({ reviewId: 'review-1' }));
  });

  it('rejects non-object payloads before dispatch', () => {
    expect(() => parseNotificationPayload('[]')).toThrow('必须是 JSON 对象');
    expect(() => parseNotificationPayload('"invalid"')).toThrow('必须是 JSON 对象');
  });
});
