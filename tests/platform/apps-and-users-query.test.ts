import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canAccessPlatformApp, platformApps } from '@/platform/apps/manifest';
import { getPlatformApp, getPortalAppGroups, getPortalApps } from '@/platform/apps/registry';
import {
  buildPlatformUserWhere,
  parsePlatformUserListFilters,
} from '@/platform/users/query';

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    appSetting: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

describe('platform app manifest', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({});
  });

  it('keeps every portal app discoverable from one registry', async () => {
    await expect(getPlatformApp('management')).resolves.toEqual(expect.objectContaining({
      href: '/portal/coming-soon/management',
      state: 'coming-soon',
    }));
    expect(platformApps.filter((app) => app.state === 'coming-soon')).toHaveLength(6);
  });

  it('only exposes platform administration to platform admins', async () => {
    const adminApp = await getPlatformApp('platform-admin');
    if (!adminApp) throw new Error('platform-admin app is missing');

    expect(canAccessPlatformApp(adminApp, false)).toBe(false);
    expect(canAccessPlatformApp(adminApp, true)).toBe(true);
    expect((await getPortalApps(false)).some((app) => app.id === 'platform-admin')).toBe(false);
  });

  it('supports a child application under a root application', async () => {
    await expect(getPlatformApp('sqm-drawing-reliability')).resolves.toMatchObject({
      id: 'sqm-drawing-reliability',
      parentId: 'sqm',
      href: '/sqm/drawing-reliability',
      state: 'active',
      launchMode: 'external-sso',
      builtin: true,
    });
    await expect(getPortalAppGroups(false)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        app: expect.objectContaining({ id: 'sqm' }),
        children: expect.arrayContaining([
          expect.objectContaining({ id: 'sqm-drawing-reliability' }),
        ]),
      }),
    ]));

    mockFindUnique.mockResolvedValueOnce({
      value: JSON.stringify({
        apps: [{
          id: 'sqm-inspection',
          parentId: 'sqm',
          href: '/sqm/inspection',
          title: 'SQM检验管理',
          description: 'SQM 独立子应用',
          iconKey: 'clipboard-check',
          state: 'active',
          access: 'authenticated',
          sortOrder: 41,
          builtin: false,
        }],
      }),
    });

    await expect(getPlatformApp('sqm-inspection')).resolves.toMatchObject({
      id: 'sqm-inspection',
      parentId: 'sqm',
      href: '/sqm/inspection',
    });
  });

  it('rejects a nested child relationship when saving the registry', async () => {
    const { savePlatformAppSettings } = await import('@/platform/apps/registry');

    await expect(savePlatformAppSettings([
      {
        id: 'sqm',
        parentId: 'npq',
        href: '/portal/coming-soon/sqm',
        title: 'SQM',
        description: 'SQM',
        iconKey: 'gauge',
        state: 'coming-soon',
        access: 'authenticated',
        sortOrder: 40,
      },
      {
        id: 'sqm-inspection',
        parentId: 'sqm',
        href: '/sqm/inspection',
        title: 'SQM检验管理',
        description: 'SQM 子应用',
        iconKey: 'clipboard-check',
        state: 'active',
        access: 'authenticated',
        sortOrder: 41,
      },
    ], 'admin-1')).rejects.toThrow('NESTED_PLATFORM_APP');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('platform user list query', () => {
  it('builds a server-side query for users without a DingTalk unionid', () => {
    const filters = parsePlatformUserListFilters(new URLSearchParams(
      'q=alice&status=active&dingtalkBinding=empty&page=2&pageSize=500',
    ));

    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(100);
    expect(buildPlatformUserWhere(filters)).toEqual({
      AND: [
        {
          OR: [
            { username: { contains: 'alice' } },
            { displayName: { contains: 'alice' } },
            { email: { contains: 'alice' } },
          ],
        },
        { status: 'active' },
        { OR: [{ unionid: null }, { unionid: '' }] },
      ],
    });
  });

  it('matches the effective default AI role when no elevated membership exists', () => {
    const filters = parsePlatformUserListFilters(new URLSearchParams('aiResourceRole=user'));

    expect(buildPlatformUserWhere(filters)).toEqual({
      OR: [
        { aiResourceMembership: { is: null } },
        { aiResourceMembership: { role: 'user' } },
      ],
    });
  });
});
