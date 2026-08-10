import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDb,
  mockEnsurePositionRole,
  mockBindUserPosition,
  mockResolveIdentity,
} = vi.hoisted(() => ({
  mockDb: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    dingTalkDepartment: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    userDingTalkDepartment: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockEnsurePositionRole: vi.fn(),
  mockBindUserPosition: vi.fn(),
  mockResolveIdentity: vi.fn(),
}));

vi.mock('@/lib/database', () => ({ db: mockDb }));
vi.mock('@/lib/db/dingtalk', () => ({
  ensurePositionRole: mockEnsurePositionRole,
  bindUserPosition: mockBindUserPosition,
}));
vi.mock('@/lib/dingtalk/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dingtalk/users')>('@/lib/dingtalk/users');
  return {
    ...actual,
    resolveDingTalkIdentityByUserId: mockResolveIdentity,
  };
});

import { applyDingTalkOrgProfile } from '@/lib/dingtalk/org-profile';

describe('applyDingTalkOrgProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsurePositionRole.mockResolvedValue('role-1');
    mockBindUserPosition.mockResolvedValue(undefined);
    mockDb.user.update.mockResolvedValue({});
    mockDb.dingTalkDepartment.findMany.mockResolvedValue([]);
    mockDb.$transaction.mockImplementation(async (callback: (tx: typeof mockDb) => unknown) =>
      callback(mockDb),
    );
  });

  it('writes title, local supervisor name and department ids', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({
      displayName: '戴锋',
      username: '013192',
    });

    const result = await applyDingTalkOrgProfile('local-1', {
      title: 'PQE',
      managerUserId: '013192',
      departmentIds: ['100', '200'],
      departmentOrders: { '200': 10, '100': 1 },
    });

    expect(mockEnsurePositionRole).toHaveBeenCalledWith('PQE');
    expect(mockBindUserPosition).toHaveBeenCalledWith('local-1', 'role-1');
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'local-1' },
      data: {
        supervisorDingtalkUserId: '013192',
        supervisorName: '戴锋',
        syncAt: expect.any(Date),
      },
    });
    expect(mockDb.dingTalkDepartment.upsert).toHaveBeenCalled();
    expect(mockDb.userDingTalkDepartment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ departmentId: '200', isPrimary: true }),
        expect.objectContaining({ departmentId: '100', isPrimary: false }),
      ]),
    });
    expect(result).toMatchObject({
      positionName: 'PQE',
      supervisorDingtalkUserId: '013192',
      supervisorName: '戴锋',
      primaryDepartmentId: '200',
    });
    expect(mockResolveIdentity).not.toHaveBeenCalled();
  });

  it('falls back to DingTalk detail for supervisor name', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce(null);
    mockResolveIdentity.mockResolvedValueOnce({
      userid: '013192',
      unionid: 'union-manager',
      name: '远程上级',
      departmentIds: [],
      departmentOrders: {},
    });

    const result = await applyDingTalkOrgProfile('local-1', {
      title: null,
      managerUserId: '013192',
      departmentIds: [],
      departmentOrders: {},
    });

    expect(mockResolveIdentity).toHaveBeenCalledWith('013192');
    expect(result.supervisorName).toBe('远程上级');
    expect(mockEnsurePositionRole).not.toHaveBeenCalled();
  });
});
