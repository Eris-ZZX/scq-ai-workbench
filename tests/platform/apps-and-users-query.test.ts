import { describe, expect, it } from 'vitest';
import { canAccessPlatformApp, getPlatformApp, getPortalApps, platformApps } from '@/platform/apps/manifest';
import {
  buildPlatformUserWhere,
  parsePlatformUserListFilters,
} from '@/platform/users/query';

describe('platform app manifest', () => {
  it('keeps every portal app discoverable from one registry', () => {
    expect(getPlatformApp('management')).toEqual(expect.objectContaining({
      href: '/portal/coming-soon/management',
      state: 'coming-soon',
    }));
    expect(platformApps.filter((app) => app.state === 'coming-soon')).toHaveLength(6);
  });

  it('only exposes platform administration to platform admins', () => {
    const adminApp = getPlatformApp('platform-admin');
    if (!adminApp) throw new Error('platform-admin app is missing');

    expect(canAccessPlatformApp(adminApp, false)).toBe(false);
    expect(canAccessPlatformApp(adminApp, true)).toBe(true);
    expect(getPortalApps(false).some((app) => app.id === 'platform-admin')).toBe(false);
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
