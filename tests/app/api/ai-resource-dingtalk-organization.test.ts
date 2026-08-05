import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  requireAiResourceRoleApi,
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
} = vi.hoisted(() => ({
  requireAiResourceRoleApi: vi.fn(),
  getDingTalkOrganizationSyncStatus: vi.fn(),
  saveDingTalkOrganizationSyncStatus: vi.fn(),
  syncDingTalkOrganization: vi.fn(),
}));

vi.mock('@/modules/ai-resources/guards', () => ({ requireAiResourceRoleApi }));
vi.mock('@/modules/ai-resources/errors', () => ({
  aiResourceErrorResponse: (error: Error) => NextResponse.json({ error: error.message }, { status: 403 }),
}));
vi.mock('@/lib/dingtalk/organization', () => ({
  DingTalkOrganizationError: class DingTalkOrganizationError extends Error {},
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
}));

import { GET, POST } from '@/app/api/ai-resources/admin/dingtalk/organization/route';

describe('DingTalk organization admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAiResourceRoleApi.mockResolvedValue({ userId: 'admin-1', username: 'admin' });
    getDingTalkOrganizationSyncStatus.mockResolvedValue({ status: 'idle' });
    saveDingTalkOrganizationSyncStatus.mockResolvedValue(undefined);
    syncDingTalkOrganization.mockResolvedValue({
      departmentCount: 3,
      directoryUserCount: 10,
      matchedUserCount: 8,
      primaryGroupCount: 8,
    });
  });

  it('returns the last synchronization status to administrators', async () => {
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
  });

  it('rejects unauthenticated or unauthorized access', async () => {
    requireAiResourceRoleApi.mockRejectedValue(new Error('forbidden'));

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(syncDingTalkOrganization).not.toHaveBeenCalled();
  });
});
