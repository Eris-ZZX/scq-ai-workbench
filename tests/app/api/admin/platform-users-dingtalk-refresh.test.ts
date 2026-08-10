import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAdmin, mockResolveIdentity, mockApplyOrgProfile, mockDatabase } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockResolveIdentity: vi.fn(),
  mockApplyOrgProfile: vi.fn(),
  mockDatabase: {
    user: {
      findUnique: vi.fn(),
    },
    dingTalkDepartment: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));
vi.mock('@/lib/dingtalk/users', () => ({
  resolveDingTalkIdentityByUserId: mockResolveIdentity,
}));
vi.mock('@/lib/dingtalk/org-profile', () => ({
  applyDingTalkOrgProfile: mockApplyOrgProfile,
}));
vi.mock('@/platform/permissions/system-admin', () => ({
  requireSystemAdminApi: mockRequireAdmin,
}));

import { POST } from '@/app/api/admin/platform-users/dingtalk/refresh/route';

describe('/api/admin/platform-users/dingtalk/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ session: { sub: 'admin-1' } });
    mockDatabase.user.findUnique.mockResolvedValue({
      id: 'local-1',
      username: '017298',
      displayName: '马跃如',
      extendedFields: JSON.stringify({ emp_no: '017298' }),
    });
    mockDatabase.$transaction.mockImplementation(async (callback: (transaction: {
      $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
    }) => unknown) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
    }));
    mockResolveIdentity.mockResolvedValue({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
      title: 'PQE',
      managerUserId: '013192',
      departmentIds: ['100'],
      departmentOrders: {},
    });
    mockApplyOrgProfile.mockResolvedValue({
      positionName: 'PQE',
      supervisorDingtalkUserId: '013192',
      supervisorName: '戴锋',
      primaryDepartmentId: '100',
      departmentIds: ['100'],
    });
    mockDatabase.dingTalkDepartment.findUnique.mockResolvedValue({
      id: '100',
      name: '100',
      parentId: null,
    });
  });

  it('resolves identity by Authing username and persists userid plus unionid', async () => {
    const response = await POST(requestWithUserId('local-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockResolveIdentity).toHaveBeenCalledWith('017298');
    expect(mockApplyOrgProfile).toHaveBeenCalledWith('local-1', expect.objectContaining({
      title: 'PQE',
      managerUserId: '013192',
      departmentIds: ['100'],
    }));
    expect(body).toMatchObject({
      matchedBy: 'userid',
      displayName: '马跃如',
      unionid: 'union-017298',
      dingtalkUserId: '017298',
      mergedUserIds: [],
      positionName: 'PQE',
      supervisor: {
        directoryUserId: '013192',
        name: '戴锋',
      },
      organization: {
        id: '100',
        name: '100',
        parentId: null,
      },
    });
  });

  it('merges a conflicting DingTalk account and reports the duplicate id', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{ id: 'duplicate-1' }])
      .mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes('SELECT id, platform_role, role, directory_user_id')) {
          return Promise.resolve([
            { id: 'local-1', platform_role: 'user', role: 'user', directory_user_id: null },
            { id: 'duplicate-1', platform_role: 'admin', role: 'manager', directory_user_id: null },
          ]);
        }
        return Promise.resolve([]);
      });
    mockDatabase.$transaction.mockImplementationOnce(async (callback: (transaction: {
      $queryRaw: typeof queryRaw;
    }) => unknown) => callback({ $queryRaw: queryRaw }));

    const response = await POST(requestWithUserId('local-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mergedUserIds).toEqual(['duplicate-1']);
    expect(queryRaw.mock.calls.some(([strings]) =>
      String(strings.join('')).includes("SET status = 'disabled'"),
    )).toBe(true);
  });

  it('rejects an Authing username and emp_no mismatch before calling DingTalk', async () => {
    mockDatabase.user.findUnique.mockResolvedValueOnce({
      id: 'local-1',
      username: '017298',
      extendedFields: JSON.stringify({ emp_no: '013192' }),
    });

    const response = await POST(requestWithUserId('local-1'));

    expect(response.status).toBe(409);
    expect(mockResolveIdentity).not.toHaveBeenCalled();
  });

  it('returns not found when DingTalk does not return a complete identity', async () => {
    mockResolveIdentity.mockResolvedValueOnce(null);

    const response = await POST(requestWithUserId('local-1'));

    expect(response.status).toBe(404);
  });
});

function requestWithUserId(userId: string) {
  return new Request('http://localhost/api/admin/platform-users/dingtalk/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}
