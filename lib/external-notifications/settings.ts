import { db, type DatabaseClient } from '@/lib/database';

export const PUBLISH_NOTIFY_ENABLED_KEY = 'external.publishNotify.enabled';
export const EXTERNAL_NOTIFICATION_CATEGORIES = [
  'reviewSubmitted',
  'reviewRejected',
  'reviewApproved',
  'publish',
] as const;
export type ExternalNotificationCategory = (typeof EXTERNAL_NOTIFICATION_CATEGORIES)[number];

const NOTIFICATION_SETTING_KEYS: Record<ExternalNotificationCategory, string> = {
  reviewSubmitted: 'external.reviewSubmittedNotify.enabled',
  reviewRejected: 'external.reviewRejectedNotify.enabled',
  reviewApproved: 'external.reviewApprovedNotify.enabled',
  publish: PUBLISH_NOTIFY_ENABLED_KEY,
};

const LEGACY_NOTIFICATION_SETTING_KEYS: Record<ExternalNotificationCategory, string> = {
  reviewSubmitted: 'dingtalk.reviewSubmittedNotify.enabled',
  reviewRejected: 'dingtalk.reviewRejectedNotify.enabled',
  reviewApproved: 'dingtalk.reviewApprovedNotify.enabled',
  publish: 'dingtalk.publishNotify.enabled',
};

export async function getAppSetting(key: string): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setAppSetting(
  key: string,
  value: string,
  updatedById?: string,
  tx: DatabaseClient = db,
) {
  return tx.appSetting.upsert({
    where: { key },
    create: { key, value, updatedById: updatedById ?? null },
    update: { value, updatedById: updatedById ?? null },
  });
}

async function isSettingEnabled(
  category: ExternalNotificationCategory,
): Promise<boolean> {
  const raw = await getAppSetting(NOTIFICATION_SETTING_KEYS[category])
    ?? await getAppSetting(LEGACY_NOTIFICATION_SETTING_KEYS[category]);
  // 未配置时默认开启，避免管理员遗漏开关导致通知静默
  if (raw == null) return true;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return raw === 'true' || raw === '1';
  }
}

export async function isExternalNotificationEnabled(
  category: ExternalNotificationCategory,
) {
  return isSettingEnabled(category);
}

export async function getExternalNotificationSettings(): Promise<
  Record<ExternalNotificationCategory, boolean>
> {
  const [reviewSubmitted, reviewRejected, reviewApproved, publish] = await Promise.all([
    isExternalNotificationEnabled('reviewSubmitted'),
    isExternalNotificationEnabled('reviewRejected'),
    isExternalNotificationEnabled('reviewApproved'),
    isExternalNotificationEnabled('publish'),
  ]);
  return { reviewSubmitted, reviewRejected, reviewApproved, publish };
}

export async function setExternalNotificationEnabled(
  category: ExternalNotificationCategory,
  enabled: boolean,
  updatedById?: string,
  tx: DatabaseClient = db,
) {
  return setAppSetting(NOTIFICATION_SETTING_KEYS[category], JSON.stringify(enabled), updatedById, tx);
}
