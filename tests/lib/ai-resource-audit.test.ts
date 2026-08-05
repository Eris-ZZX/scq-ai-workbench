import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    aiResourceAuditLog: {
      create: mockCreate,
    },
  },
}));

vi.mock('@/platform/observability/tracer', () => ({
  getTracer: () => ({ currentTraceId: 'trace-test' }),
}));

import {
  appendAiResourceAuditLog,
  summarizeResource,
} from '@/modules/ai-resources/audit';

describe('AI resource audit log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('redacts sensitive resource content before persistence', async () => {
    await appendAiResourceAuditLog({
      actorId: 'actor-1',
      actorUsername: 'alice',
      action: 'resource.update',
      targetType: 'RESOURCE',
      targetId: 'resource-1',
      result: 'SUCCESS',
      before: {
        name: 'Old resource',
        content: 'private implementation',
        attachments: [{ name: 'secret.txt' }],
      },
      after: {
        name: 'New resource',
        resourceUrl: 'https://internal.example/resource',
        password: 'not-for-logs',
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        traceId: 'trace-test',
        beforeData: JSON.stringify({
          name: 'Old resource',
          content: '[redacted]',
          attachments: '[redacted]',
        }),
        afterData: JSON.stringify({
          name: 'New resource',
          resourceUrl: '[redacted]',
          password: '[redacted]',
        }),
      }),
    });
  });

  it('keeps only the non-sensitive resource summary', () => {
    expect(summarizeResource({
      id: 'resource-1',
      name: 'Resource',
      content: 'private',
      attachments: ['file'],
      ownerName: 'alice',
      status: 'PUBLISHED',
    })).toEqual({
      id: 'resource-1',
      name: 'Resource',
      type: undefined,
      status: 'PUBLISHED',
      ownerId: undefined,
      ownerName: 'alice',
      visibilityScope: undefined,
      tags: undefined,
      currentVersion: undefined,
      viewCount: undefined,
    });
  });
});
