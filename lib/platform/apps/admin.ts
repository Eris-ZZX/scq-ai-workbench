import {
  getExternalAppConnectionView,
  type ExternalAppConnectionView,
} from '@/platform/sso/external-connection';
import {
  getPlatformAppRecords,
} from './registry';
import type { PlatformAppRecord } from './manifest';

export type PlatformAppAdminRecord = PlatformAppRecord & {
  connection: ExternalAppConnectionView | null;
};

export async function getPlatformAppAdminSettings() {
  const apps = await getPlatformAppRecords();
  const adminApps = await Promise.all(apps.map(async (app): Promise<PlatformAppAdminRecord> => ({
    ...app,
    connection: app.launchMode === 'internal'
      ? null
      : await getExternalAppConnectionView(app.id, app.title),
  })));

  return { apps: adminApps };
}
