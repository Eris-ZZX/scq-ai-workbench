import type { PlatformApp } from './manifest';
import { getExternalAppConnectionView } from '@/platform/sso/external-connection';

export type PlatformAppLaunch = {
  href: string;
  external: boolean;
  enabled: boolean;
};

export async function getPlatformAppLaunch(app: PlatformApp): Promise<PlatformAppLaunch> {
  if (app.launchMode === 'internal') {
    return {
      href: app.href,
      external: false,
      enabled: true,
    };
  }

  if (app.launchMode === 'external-sso') {
    const connection = await getExternalAppConnectionView(app.id, app.title);
    return {
      href: `/portal/external-apps/${encodeURIComponent(app.id)}`,
      external: false,
      enabled: app.state === 'active'
        && connection.enabled
        && connection.secretConfigured
        && Boolean(connection.launchUrl),
    };
  }

  const connection = await getExternalAppConnectionView(app.id, app.title);
  return {
    href: connection.launchUrl,
    external: true,
    enabled: app.state === 'active' && connection.enabled && Boolean(connection.launchUrl),
  };
}
