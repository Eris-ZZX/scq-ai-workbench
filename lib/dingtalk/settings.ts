export {
  getAppSetting,
  getExternalNotificationSettings,
  isExternalNotificationEnabled,
  PUBLISH_NOTIFY_ENABLED_KEY,
  setAppSetting,
  setExternalNotificationEnabled,
  EXTERNAL_NOTIFICATION_CATEGORIES,
  type ExternalNotificationCategory,
} from '@/lib/external-notifications/settings';

/** @deprecated Use the generic external-notifications module. */
export {
  EXTERNAL_NOTIFICATION_CATEGORIES as DINGTALK_NOTIFICATION_CATEGORIES,
  type ExternalNotificationCategory as DingTalkNotificationCategory,
} from '@/lib/external-notifications/settings';

/** @deprecated Use isExternalNotificationEnabled. */
export {
  isExternalNotificationEnabled as isDingTalkNotificationEnabled,
  getExternalNotificationSettings as getDingTalkNotificationSettings,
  setExternalNotificationEnabled as setDingTalkNotificationEnabled,
} from '@/lib/external-notifications/settings';

/** @deprecated Use isExternalNotificationEnabled('publish'). */
export async function isPublishNotifyEnabled() {
  const { isExternalNotificationEnabled } = await import('@/lib/external-notifications/settings');
  return isExternalNotificationEnabled('publish');
}

/** @deprecated Use setExternalNotificationEnabled('publish', enabled). */
export async function setPublishNotifyEnabled(enabled: boolean, updatedById?: string) {
  const { setExternalNotificationEnabled } = await import('@/lib/external-notifications/settings');
  return setExternalNotificationEnabled('publish', enabled, updatedById);
}
