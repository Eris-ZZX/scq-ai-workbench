import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveIdentity, mockDatabase, mockTransaction, mockApplyOrgProfile } = vi.hoisted(() => ({
  mockResolveIdentity: vi.fn(),
  mockApplyOrgProfile: vi.fn(),
  mockDatabase: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  mockTransaction: {
    $queryRaw: vi.fn(),
    user: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));
vi.mock('@/lib/db/auth', () => ({ DUMMY_HASH: 'dummy-hash' }));
vi.mock('@/lib/dingtalk/users', () => ({
  resolveDingTalkIdentityByUserId: mockResolveIdentity,
}));
vi.mock('@/lib/dingtalk/org-profile', () => ({
  applyDingTalkOrgProfile: mockApplyOrgProfile,
}));

import { upsertAuthingUser } from '@/platform/auth/external-users';

describe('Authing external user DingTalk binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.$transaction.mockRejectedValue(new Error('stop before transaction'));
    mockApplyOrgProfile.mockResolvedValue({
      positionName: null,
      supervisorDingtalkUserId: null,
      supervisorName: null,
      primaryDepartmentId: null,
      departmentIds: [],
    });
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

  it('resolves DingTalk identity on every Authing login', async () => {
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

  it('merges identity and DingTalk candidates into the Authing account', async () => {
    mockResolveIdentity.mockResolvedValueOnce({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
      title: 'PQE',
      managerUserId: '013192',
      departmentIds: ['100'],
      departmentOrders: {},
    });
    mockDatabase.$transaction.mockImplementation(async (callback: (transaction: typeof mockTransaction) => unknown) => {
      return callback(mockTransaction);
    });
    mockTransaction.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join('');
      if (sql.includes('FROM users AS u')) {
        return Promise.resolve([
          {
            id: 'authing-user',
            username: '017298',
            display_name: 'Authing Display',
            email: 'mayr@shokz.com.cn',
            platform_role: 'admin',
            role: 'manager',
            status: 'active',
            has_authing_identity: true,
            username_match: true,
            email_match: true,
            unionid_match: false,
            userid_match: false,
          },
          {
            id: 'dingtalk-user',
            username: 'old-name',
            display_name: 'Old Name',
            email: null,
            platform_role: 'user',
            role: 'user',
            status: 'active',
            has_authing_identity: false,
            username_match: false,
            email_match: false,
            unionid_match: true,
            userid_match: false,
          },
        ]);
      }
      if (sql.includes('SELECT id, username, display_name')) {
        return Promise.resolve([{
          id: 'authing-user',
          username: '017298',
          display_name: 'Authing Display',
          email: 'mayr@shokz.com.cn',
          avatar: null,
          platform_role: 'admin',
          role: 'manager',
          status: 'active',
        }]);
      }
      if (sql.includes('SELECT id, platform_role, role, directory_user_id')) {
        return Promise.resolve([
          { id: 'authing-user', platform_role: 'admin', role: 'manager', directory_user_id: null },
          { id: 'dingtalk-user', platform_role: 'user', role: 'user', directory_user_id: null },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await upsertAuthingUser(identity({
      username: '017298',
      employeeNumber: '017298',
    }));

    expect(result).toMatchObject({
      id: 'authing-user',
      displayName: 'Authing Display',
      mergedUserIds: ['dingtalk-user'],
    });
    expect(mockApplyOrgProfile).toHaveBeenCalledWith('authing-user', expect.objectContaining({
      title: 'PQE',
      managerUserId: '013192',
      departmentIds: ['100'],
    }));
    expect(mockTransaction.$queryRaw.mock.calls.some(([strings]) =>
      String(strings.join('')).includes("SET status = 'disabled'"),
    )).toBe(true);
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
