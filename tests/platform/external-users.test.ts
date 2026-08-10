import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveIdentity, mockDatabase } = vi.hoisted(() => ({
  mockResolveIdentity: vi.fn(),
  mockDatabase: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));
vi.mock('@/lib/db/auth', () => ({ DUMMY_HASH: 'dummy-hash' }));
vi.mock('@/lib/dingtalk/users', () => ({
  resolveDingTalkIdentityByUserId: mockResolveIdentity,
}));

import { upsertAuthingUser } from '@/platform/auth/external-users';

describe('Authing external user DingTalk binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.$transaction.mockRejectedValue(new Error('stop before transaction'));
  });

  it('rejects an Authing username and emp_no mismatch', async () => {
    mockDatabase.$queryRaw.mockResolvedValueOnce([]);

    await expect(upsertAuthingUser(identity({
      username: '017298',
      employeeNumber: '013192',
    }))).rejects.toMatchObject({
      code: 'conflict',
    });

    expect(mockResolveIdentity).not.toHaveBeenCalled();
  });

  it('re-resolves DingTalk identity when an existing Authing binding lacks mapping fields', async () => {
    mockDatabase.$queryRaw.mockResolvedValueOnce([{
      user_id: 'local-1',
      unionid: null,
      dingtalk_user_id: null,
    }]);
    mockResolveIdentity.mockResolvedValueOnce({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
    });

    await expect(upsertAuthingUser(identity({
      username: '017298',
      employeeNumber: '017298',
    }))).rejects.toThrow('stop before transaction');

    expect(mockResolveIdentity).toHaveBeenCalledWith('017298');
  });

  it('does not re-query a complete existing Authing binding', async () => {
    mockDatabase.$queryRaw.mockResolvedValueOnce([{
      user_id: 'local-1',
      unionid: 'union-017298',
      dingtalk_user_id: '017298',
    }]);

    await expect(upsertAuthingUser(identity({
      username: '017298',
      employeeNumber: '017298',
    }))).rejects.toThrow('stop before transaction');

    expect(mockResolveIdentity).not.toHaveBeenCalled();
  });
});

function identity(overrides: { username: string; employeeNumber: string }) {
  return {
    issuer: 'https://auth.example.test',
    subject: 'auth-sub',
    username: overrides.username,
    name: '马跃如',
    email: 'mayr@shokz.com.cn',
    avatar: null,
    unionid: null,
    phoneNumber: '13080534337',
    phoneNumberVerified: true,
    emailVerified: false,
    address: null,
    birthdate: null,
    gender: null,
    locale: null,
    nickname: null,
    preferredUsername: null,
    profile: null,
    website: null,
    zoneinfo: null,
    externalId: null,
    extendedFields: JSON.stringify({ emp_no: overrides.employeeNumber }),
    employeeNumber: overrides.employeeNumber,
    tenantId: null,
    userpoolId: null,
    roles: null,
  } as const;
}
