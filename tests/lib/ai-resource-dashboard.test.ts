import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDatabase } = vi.hoisted(() => ({
  mockDatabase: {
    aiResource: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    aiResourceReviewRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    aiResourceUpdateLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));

import { getAiResourceDashboard } from '@/modules/ai-resources/dashboard';

describe('AI resource dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.aiResource.count.mockImplementation(async ({ where }: { where?: { status?: string } } = {}) => {
      if (!where?.status) return 4;
      return { DRAFT: 1, PUBLISHED: 2, ARCHIVED: 1 }[where.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'] ?? 0;
    });
    mockDatabase.aiResource.aggregate.mockResolvedValue({ _sum: { viewCount: 42 } });
    mockDatabase.aiResource.findMany.mockResolvedValue([
      {
        id: 'resource-1',
        name: 'Popular resource',
        type: 'AGENT',
        status: 'PUBLISHED',
        viewCount: 42,
        ownerName: 'alice',
        updatedAt: new Date(),
      },
    ]);
    mockDatabase.aiResourceReviewRequest.count.mockImplementation(async ({ where }: { where: { status: string } }) => (
      { PENDING: 2, REJECTED: 1, APPROVED: 3 }[where.status as 'PENDING' | 'REJECTED' | 'APPROVED'] ?? 0
    ));
    mockDatabase.aiResourceReviewRequest.findMany.mockResolvedValue([]);
    mockDatabase.aiResourceUpdateLog.findMany.mockResolvedValue([
      { action: 'CREATE', result: 'APPROVED', createdAt: new Date() },
      { action: 'UPDATE', result: 'DONE', createdAt: new Date() },
    ]);
  });

  it('returns current summary, capped period, trend and top resources', async () => {
    const dashboard = await getAiResourceDashboard(365);

    expect(dashboard.days).toBe(90);
    expect(dashboard.summary).toMatchObject({
      totalResources: 4,
      draftResources: 1,
      publishedResources: 2,
      archivedResources: 1,
      totalViews: 42,
      pendingReviews: 2,
      rejectedReviews: 1,
      approvedReviews: 3,
    });
    expect(dashboard.trend).toHaveLength(90);
    expect(dashboard.trend.at(-1)).toMatchObject({ created: 1, updated: 1, approved: 2 });
    expect(dashboard.topResources[0]?.name).toBe('Popular resource');
  });
});
