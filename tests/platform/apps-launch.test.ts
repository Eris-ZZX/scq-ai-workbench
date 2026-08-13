import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApps } from '@/platform/apps/manifest';

const { mockGetConnectionView } = vi.hoisted(() => ({
  mockGetConnectionView: vi.fn(),
}));

vi.mock('@/platform/sso/external-connection', () => ({
  getExternalAppConnectionView: mockGetConnectionView,
}));

import { getPlatformAppLaunch } from '@/platform/apps/launch';

describe('platform app launch modes', () => {
  beforeEach(() => {
    mockGetConnectionView.mockReset();
  });

  it('keeps internal applications on their configured local path', async () => {
    const app = platformApps.find((candidate) => candidate.id === 'npq');
    if (!app) throw new Error('npq app is missing');

    await expect(getPlatformAppLaunch(app)).resolves.toEqual({
      href: '/workbench',
      external: false,
      enabled: true,
    });
    expect(mockGetConnectionView).not.toHaveBeenCalled();
  });

  it('opens enabled pure-link applications externally', async () => {
    const app = {
      ...platformApps[0],
      id: 'external-link-app',
      launchMode: 'external-link' as const,
    };
    mockGetConnectionView.mockResolvedValue({
      appId: app.id,
      displayName: app.title,
      launchUrl: 'https://external.example.test/',
      note: '',
      enabled: true,
      secretConfigured: false,
      secretHint: '',
      source: 'database',
      updatedAt: null,
    });

    await expect(getPlatformAppLaunch(app)).resolves.toEqual({
      href: 'https://external.example.test/',
      external: true,
      enabled: true,
    });
  });

  it('requires an SSO secret before exposing the dynamic launcher', async () => {
    const app = platformApps.find((candidate) => candidate.id === 'sqm-drawing-reliability');
    if (!app) throw new Error('drawing reliability app is missing');

    mockGetConnectionView.mockResolvedValue({
      appId: app.id,
      displayName: app.title,
      launchUrl: 'https://drawing.example.test/',
      note: '',
      enabled: true,
      secretConfigured: false,
      secretHint: '',
      source: 'database',
      updatedAt: null,
    });

    await expect(getPlatformAppLaunch(app)).resolves.toEqual({
      href: `/portal/external-apps/${app.id}`,
      external: false,
      enabled: false,
    });
  });
});
