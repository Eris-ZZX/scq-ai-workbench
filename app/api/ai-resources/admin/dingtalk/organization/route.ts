import { NextResponse } from 'next/server';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import {
  DingTalkOrganizationError,
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
} from '@/lib/dingtalk/organization';

let activeSync: Promise<Awaited<ReturnType<typeof syncDingTalkOrganization>>> | null = null;

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');
    return NextResponse.json({ status: await getDingTalkOrganizationSyncStatus() });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST() {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    if (activeSync) {
      return NextResponse.json({ error: '钉钉组织同步正在进行中，请稍后再试。' }, { status: 409 });
    }

    const startedAt = new Date().toISOString();
    const syncPromise = (async () => {
      await saveDingTalkOrganizationSyncStatus({
        status: 'running',
        startedAt,
        actorUsername: actor.username,
      }, actor.userId);
      return syncDingTalkOrganization();
    })();
    activeSync = syncPromise;
    try {
      const result = await syncPromise;
      const finishedAt = new Date().toISOString();
      const status = {
        status: 'success' as const,
        startedAt,
        finishedAt,
        actorUsername: actor.username,
        ...result,
      };
      await saveDingTalkOrganizationSyncStatus(status, actor.userId);
      return NextResponse.json({ status });
    } catch (error) {
      const message = error instanceof DingTalkOrganizationError
        ? error.message
        : '钉钉组织同步失败，请检查通讯录权限和服务端日志。';
      const status = {
        status: 'failed' as const,
        startedAt,
        finishedAt: new Date().toISOString(),
        actorUsername: actor.username,
        error: message,
      };
      await saveDingTalkOrganizationSyncStatus(status, actor.userId);
      return NextResponse.json({ error: message, status }, { status: 502 });
    } finally {
      if (activeSync === syncPromise) activeSync = null;
    }
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
