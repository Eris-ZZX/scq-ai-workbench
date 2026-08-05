import { NextResponse } from 'next/server';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';
import {
  DingTalkOrganizationError,
  getDingTalkOrganizationSyncStatus,
  saveDingTalkOrganizationSyncStatus,
  syncDingTalkOrganization,
} from '@/lib/dingtalk/organization';

let activeSync: Promise<Awaited<ReturnType<typeof syncDingTalkOrganization>>> | null = null;

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ status: await getDingTalkOrganizationSyncStatus() });
}

export async function POST() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const actor = auth.session;
  if (activeSync) {
    return NextResponse.json({ error: '钉钉组织同步正在进行中，请稍后再试。' }, { status: 409 });
  }

  const startedAt = new Date().toISOString();
  const syncPromise = (async () => {
    await saveDingTalkOrganizationSyncStatus({
      status: 'running',
      startedAt,
      actorUsername: actor.username,
    }, actor.sub);
    return syncDingTalkOrganization();
  })();
  activeSync = syncPromise;

  try {
    const result = await syncPromise;
    const status = {
      status: 'success' as const,
      startedAt,
      finishedAt: new Date().toISOString(),
      actorUsername: actor.username,
      ...result,
    };
    await saveDingTalkOrganizationSyncStatus(status, actor.sub);
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
    await saveDingTalkOrganizationSyncStatus(status, actor.sub);
    return NextResponse.json({ error: message, status }, { status: 502 });
  } finally {
    if (activeSync === syncPromise) activeSync = null;
  }
}
