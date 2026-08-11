import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockIsPlatformAdmin } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsPlatformAdmin: vi.fn(),
}));

vi.mock('@/platform/auth/auth.config', () => ({
  getSession: mockGetSession,
}));
vi.mock('@/platform/permissions/system-admin', () => ({
  isPlatformAdmin: mockIsPlatformAdmin,
}));

import { requirePlatformAppApi } from '@/platform/apps/access';

describe('platform app access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 before checking application permissions', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(requirePlatformAppApi('npq')).resolves.toEqual({
      error: '未登录',
      status: 401,
    });
    expect(mockIsPlatformAdmin).not.toHaveBeenCalled();
  });

  it('keeps platform administration behind the platform-admin boundary', async () => {
    mockGetSession.mockResolvedValueOnce({
      sub: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      role: 'user',
      platformRole: 'user',
    });
    mockIsPlatformAdmin.mockReturnValueOnce(false);

    await expect(requirePlatformAppApi('platform-admin')).resolves.toEqual({
      error: '无权访问该应用',
      status: 403,
    });
  });

  it('returns a principal for an authenticated application request', async () => {
    const session = {
      sub: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      role: 'user',
      platformRole: 'user',
    };
    mockGetSession.mockResolvedValueOnce(session);
    mockIsPlatformAdmin.mockReturnValueOnce(false);

    await expect(requirePlatformAppApi('npq')).resolves.toMatchObject({
      app: { id: 'npq', href: '/workbench' },
      principal: { ...session, isPlatformAdmin: false },
    });
  });
});
