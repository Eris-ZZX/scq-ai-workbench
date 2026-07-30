import { prisma } from '@/lib/prisma';

export const PUBLISH_NOTIFY_ENABLED_KEY = 'dingtalk.publishNotify.enabled';

export async function getAppSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setAppSetting(key: string, value: string, updatedById?: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedById: updatedById ?? null },
    update: { value, updatedById: updatedById ?? null },
  });
}

export async function isPublishNotifyEnabled(): Promise<boolean> {
  const raw = await getAppSetting(PUBLISH_NOTIFY_ENABLED_KEY);
  // 未配置时默认开启，避免管理员遗漏开关导致无广播
  if (raw == null) return true;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return raw === 'true' || raw === '1';
  }
}

export async function setPublishNotifyEnabled(enabled: boolean, updatedById?: string) {
  return setAppSetting(PUBLISH_NOTIFY_ENABLED_KEY, JSON.stringify(enabled), updatedById);
}
