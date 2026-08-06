import { NextResponse } from 'next/server';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';
import {
  DingTalkOrganizationError,
  getDingTalkUserRefreshStatus,
  refreshDingTalkUserDetails,
  saveDingTalkUserRefreshStatus,
} from '@/lib/dingtalk/organization';

let activeRefresh: Promise<Awaited<ReturnType<typeof refreshDingTalkUserDetails>>> | null = null;

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ status: await getDingTalkUserRefreshStatus() });
}

export async function POST() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const actor = auth.session;
  if (activeRefresh) {
    return NextResponse.json({ error: '用户信息刷新正在进行中，请稍后再试。' }, { status: 409 });
  }

  const startedAt = new Date().toISOString();
  const refreshPromise = (async () => {
    await saveDingTalkUserRefreshStatus({
      status: 'running',
      startedAt,
      actorUsername: actor.username,
    }, actor.sub);
    return refreshDingTalkUserDetails();
  })();
  activeRefresh = refreshPromise;

  try {
    const result = await refreshPromise;
    const status = {
      status: 'success' as const,
      startedAt,
      finishedAt: new Date().toISOString(),
      actorUsername: actor.username,
      ...result,
    };
    await saveDingTalkUserRefreshStatus(status, actor.sub);
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof DingTalkOrganizationError
      ? error.message
      : '用户信息刷新失败，请检查钉钉通讯录权限和服务端日志。';
    const status = {
      status: 'failed' as const,
      startedAt,
      finishedAt: new Date().toISOString(),
      actorUsername: actor.username,
      error: message,
    };
    await saveDingTalkUserRefreshStatus(status, actor.sub);
    return NextResponse.json({ error: message, status }, { status: 502 });
  } finally {
    if (activeRefresh === refreshPromise) activeRefresh = null;
  }
}
