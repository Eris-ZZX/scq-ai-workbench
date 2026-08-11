import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAdmin, mockDatabase } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockDatabase: {
    authLoginLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/platform/permissions/system-admin', () => ({
  requireSystemAdminApi: mockRequireAdmin,
}));
vi.mock('@/lib/database', () => ({ db: mockDatabase }));

import { GET as listLogs } from '@/app/api/admin/auth-login-logs/route';

describe('/api/admin/auth-login-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ session: { sub: 'admin-1' } });
    mockDatabase.authLoginLog.findMany.mockResolvedValue([]);
    mockDatabase.authLoginLog.count.mockResolvedValue(0);
  });

  it('rejects non-admin log reads', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ error: '需要平台管理员权限', status: 403 });

    const response = await listLogs(new Request('http://localhost/api/admin/auth-login-logs'));

    expect(response.status).toBe(403);
    expect(mockDatabase.authLoginLog.findMany).not.toHaveBeenCalled();
  });

  it('applies safe filters and returns parsed error parameters', async () => {
    mockDatabase.authLoginLog.findMany.mockResolvedValueOnce([{
      id: 'log-1',
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      username: '329662',
      displayName: '刘富荣',
      errorCode: 'authing',
      errorMessage: 'user lookup failed',
      errorParams: JSON.stringify({ error: 'access_denied', code: 'secret' }),
      authingData: JSON.stringify({
        username: '314265',
        unionid: null,
        extended_fields: { emp_no: '314265' },
      }),
      requestPath: '/api/auth/authing/callback',
      ipAddress: '192.0.2.10',
      userAgent: 'test-agent',
      createdAt: new Date('2026-08-11T02:00:00.000Z'),
      user: null,
    }]);
    mockDatabase.authLoginLog.count.mockResolvedValueOnce(1);

    const response = await listLogs(new Request(
      'http://localhost/api/admin/auth-login-logs?q=329662&provider=authing&outcome=failure&page=2',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].errorParams).toEqual({ error: 'access_denied' });
    expect(body.items[0].authingData).toEqual({
      username: '314265',
      unionid: null,
      extended_fields: { emp_no: '314265' },
    });
    expect(body.items[0]).toMatchObject({
      requestPath: '/api/auth/authing/callback',
      ipAddress: '192.0.2.10',
      userAgent: 'test-agent',
    });
    expect(body.pagination).toMatchObject({ page: 2, total: 1, totalPages: 1 });
    expect(mockDatabase.authLoginLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { provider: 'authing' },
          { outcome: 'failure' },
          {
            OR: [
              { username: { contains: '329662' } },
              { displayName: { contains: '329662' } },
              { errorCode: { contains: '329662' } },
              { errorMessage: { contains: '329662' } },
            ],
          },
        ],
      },
    }));
  });
});
