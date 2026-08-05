import { db, type DatabaseClient } from '@/lib/database';

export const PUBLISH_NOTIFY_ENABLED_KEY = 'dingtalk.publishNotify.enabled';
export const DINGTALK_NOTIFICATION_CATEGORIES = [
  'reviewSubmitted',
  'reviewRejected',
  'reviewApproved',
  'publish',
] as const;
export type DingTalkNotificationCategory = (typeof DINGTALK_NOTIFICATION_CATEGORIES)[number];

const NOTIFICATION_SETTING_KEYS: Record<DingTalkNotificationCategory, string> = {
  reviewSubmitted: 'dingtalk.reviewSubmittedNotify.enabled',
  reviewRejected: 'dingtalk.reviewRejectedNotify.enabled',
  reviewApproved: 'dingtalk.reviewApprovedNotify.enabled',
  publish: PUBLISH_NOTIFY_ENABLED_KEY,
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

async function isSettingEnabled(key: string): Promise<boolean> {
  const raw = await getAppSetting(key);
  // 未配置时默认开启，避免管理员遗漏开关导致通知静默
  if (raw == null) return true;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return raw === 'true' || raw === '1';
  }
}

export async function isDingTalkNotificationEnabled(
  category: DingTalkNotificationCategory,
): Promise<boolean> {
  return isSettingEnabled(NOTIFICATION_SETTING_KEYS[category]);
}

export async function getDingTalkNotificationSettings(): Promise<
  Record<DingTalkNotificationCategory, boolean>
> {
  const [reviewSubmitted, reviewRejected, reviewApproved, publish] = await Promise.all([
    isDingTalkNotificationEnabled('reviewSubmitted'),
    isDingTalkNotificationEnabled('reviewRejected'),
    isDingTalkNotificationEnabled('reviewApproved'),
    isDingTalkNotificationEnabled('publish'),
  ]);
  return { reviewSubmitted, reviewRejected, reviewApproved, publish };
}

export async function setDingTalkNotificationEnabled(
  category: DingTalkNotificationCategory,
  enabled: boolean,
  updatedById?: string,
  tx: DatabaseClient = db,
) {
  return setAppSetting(NOTIFICATION_SETTING_KEYS[category], JSON.stringify(enabled), updatedById, tx);
}

export async function isPublishNotifyEnabled(): Promise<boolean> {
  return isDingTalkNotificationEnabled('publish');
}

export async function setPublishNotifyEnabled(enabled: boolean, updatedById?: string) {
  return setDingTalkNotificationEnabled('publish', enabled, updatedById);
}
