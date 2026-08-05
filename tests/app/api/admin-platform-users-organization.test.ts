import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireSystemAdminApi,
  DingTalkOrganizationError,
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
} = vi.hoisted(() => {
  class MockDingTalkOrganizationError extends Error {}

  return {
    requireSystemAdminApi: vi.fn(),
    DingTalkOrganizationError: MockDingTalkOrganizationError,
    getDingTalkOrganizationSyncStatus: vi.fn(),
    saveDingTalkOrganizationSyncStatus: vi.fn(),
    syncDingTalkOrganization: vi.fn(),
  };
});

vi.mock('@/platform/permissions/system-admin', () => ({ requireSystemAdminApi }));
vi.mock('@/lib/dingtalk/organization', () => ({
  DingTalkOrganizationError,
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
}));

import { GET, POST } from '@/app/api/admin/platform-users/organization/route';

describe('platform DingTalk organization admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSystemAdminApi.mockResolvedValue({
      session: { sub: 'admin-1', username: 'admin', role: 'admin', platformRole: 'admin' },
    });
    getDingTalkOrganizationSyncStatus.mockResolvedValue({ status: 'idle' });
    saveDingTalkOrganizationSyncStatus.mockResolvedValue(undefined);
    syncDingTalkOrganization.mockResolvedValue({
      departmentCount: 3,
      directoryUserCount: 10,
      matchedUserCount: 8,
      primaryGroupCount: 8,
    });
  });

  it('returns the last synchronization status to platform administrators', async () => {
    getDingTalkOrganizationSyncStatus.mockResolvedValue({ status: 'success', matchedUserCount: 8 });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: { status: 'success', matchedUserCount: 8 },
    });
  });

  it('runs one protected full synchronization and persists the result', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toMatchObject({
      status: 'success',
      departmentCount: 3,
      matchedUserCount: 8,
      actorUsername: 'admin',
    });
    expect(syncDingTalkOrganization).toHaveBeenCalledOnce();
    expect(saveDingTalkOrganizationSyncStatus).toHaveBeenCalledTimes(2);
    expect(saveDingTalkOrganizationSyncStatus.mock.calls[0][1]).toBe('admin-1');
    expect(saveDingTalkOrganizationSyncStatus.mock.calls[1][1]).toBe('admin-1');
  });

  it('returns a failed status when the synchronization service fails', async () => {
    syncDingTalkOrganization.mockRejectedValueOnce(
      new DingTalkOrganizationError('通讯录读取失败'),
    );

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: '通讯录读取失败',
      status: { status: 'failed', actorUsername: 'admin', error: '通讯录读取失败' },
    });
  });

  it('rejects a second synchronization while one is active', async () => {
    let resolveSync!: (value: {
      departmentCount: number;
      directoryUserCount: number;
      matchedUserCount: number;
      primaryGroupCount: number;
    }) => void;
    syncDingTalkOrganization.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );

    const firstRequest = POST();
    await vi.waitFor(() => expect(syncDingTalkOrganization).toHaveBeenCalledOnce());

    const secondResponse = await POST();
    expect(secondResponse.status).toBe(409);

    resolveSync({
      departmentCount: 1,
      directoryUserCount: 1,
      matchedUserCount: 1,
      primaryGroupCount: 1,
    });
    expect((await firstRequest).status).toBe(200);
  });

  it('rejects non-platform administrators', async () => {
    requireSystemAdminApi.mockResolvedValue({
      error: '需要平台管理员权限',
      status: 403,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '需要平台管理员权限' });
    expect(syncDingTalkOrganization).not.toHaveBeenCalled();
  });
});
