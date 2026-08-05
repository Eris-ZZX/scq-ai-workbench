import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('@/lib/database', () => ({ db: { $queryRaw: queryRaw } }));

import {
  enqueueExternalJob,
  retryDelayForAttempt,
  type ExternalJob,
} from '@/lib/external-jobs';

describe('external job outbox contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists JSON payloads through one idempotent insert contract', async () => {
    queryRaw.mockResolvedValueOnce([{
      id: 'job-1',
      kind: 'notification.test',
      idempotency_key: 'notification.test:one',
      payload: '{"value":"ok"}',
      status: 'pending',
      attempts: 0,
      available_at: new Date('2026-01-01T00:00:00Z'),
      locked_at: null,
      locked_by: null,
      last_error: null,
      result: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    }]);

    const job = await enqueueExternalJob({
      kind: 'notification.test',
      idempotencyKey: 'notification.test:one',
      payload: { value: 'ok' },
    });

    expect(job).toMatchObject<Partial<ExternalJob>>({
      id: 'job-1',
      kind: 'notification.test',
      idempotencyKey: 'notification.test:one',
      payload: { value: 'ok' },
      status: 'pending',
    });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('uses bounded exponential retry delays', () => {
    expect(retryDelayForAttempt(0)).toBe(5_000);
    expect(retryDelayForAttempt(5)).toBe(32_000);
    expect(retryDelayForAttempt(20)).toBe(3_600_000);
  });
});
