import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AiResourceError } from '@/modules/ai-resources/errors';

const { mockGuard, mockDatabase } = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockDatabase: {
    aiResourceAuditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/modules/ai-resources/guards', () => ({
  requireAiResourceRoleApi: mockGuard,
}));

vi.mock('@/lib/database', () => ({
  db: mockDatabase,
  databaseErrorStatus: vi.fn(() => undefined),
}));

import { GET } from '@/app/api/ai-resources/admin/audit-logs/route';

describe('/api/ai-resources/admin/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: 'admin-1' });
    mockDatabase.aiResourceAuditLog.count.mockResolvedValue(1);
    mockDatabase.aiResourceAuditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actorUsernameSnapshot: 'admin',
        action: 'resource.update',
        targetType: 'RESOURCE',
        result: 'SUCCESS',
      },
    ]);
  });

  it('blocks non-admin users before querying audit records', async () => {
    mockGuard.mockRejectedValueOnce(new AiResourceError('权限不足', 403, 'FORBIDDEN'));

    const response = await GET(new NextRequest('http://localhost/api/ai-resources/admin/audit-logs'));

    expect(response.status).toBe(403);
    expect(mockDatabase.aiResourceAuditLog.count).not.toHaveBeenCalled();
    expect(mockDatabase.aiResourceAuditLog.findMany).not.toHaveBeenCalled();
  });

  it('returns paginated audit records for an authorized admin', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/ai-resources/admin/audit-logs?actor=admin&result=SUCCESS&page=2&pageSize=10',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDatabase.aiResourceAuditLog.count).toHaveBeenCalledWith({
      where: { actorUsernameSnapshot: { contains: 'admin' }, result: 'SUCCESS' },
    });
    expect(mockDatabase.aiResourceAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: { actorUsernameSnapshot: { contains: 'admin' }, result: 'SUCCESS' },
    }));
    expect(body).toMatchObject({ total: 1, page: 2, pageSize: 10, totalPages: 1 });
  });
});
