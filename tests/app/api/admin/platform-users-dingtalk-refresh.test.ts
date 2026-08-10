import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAdmin, mockResolveIdentity, mockDatabase } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockResolveIdentity: vi.fn(),
  mockDatabase: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));
vi.mock('@/lib/dingtalk/users', () => ({
  resolveDingTalkIdentityByUserId: mockResolveIdentity,
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
      extendedFields: JSON.stringify({ emp_no: '017298' }),
    });
    mockDatabase.user.findFirst.mockResolvedValue(null);
    mockDatabase.user.update.mockResolvedValue({});
    mockResolveIdentity.mockResolvedValue({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
    });
  });

  it('resolves identity by Authing username and persists userid plus unionid', async () => {
    const response = await POST(requestWithUserId('local-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockResolveIdentity).toHaveBeenCalledWith('017298');
    expect(mockDatabase.user.update).toHaveBeenCalledWith({
      where: { id: 'local-1' },
      data: {
        unionid: 'union-017298',
        dingtalkUserId: '017298',
      },
    });
    expect(body).toMatchObject({
      matchedBy: 'userid',
      unionid: 'union-017298',
      dingtalkUserId: '017298',
    });
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
    expect(mockDatabase.user.update).not.toHaveBeenCalled();
  });
});

function requestWithUserId(userId: string) {
  return new Request('http://localhost/api/admin/platform-users/dingtalk/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}
