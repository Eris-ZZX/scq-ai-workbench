import { NextResponse } from 'next/server';
import {
  getPlatformAppSettings,
  savePlatformAppSettings,
} from '@/lib/platform/apps/registry';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(await getPlatformAppSettings());
}

export async function PUT(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null) as { apps?: unknown[] } | null;
  if (!Array.isArray(body?.apps)) {
    return NextResponse.json({ error: '缺少平台应用配置。' }, { status: 400 });
  }

  const apps = body.apps.map((item) => (
    item && typeof item === 'object'
      ? item
      : {}
  ));

  try {
    return NextResponse.json(await savePlatformAppSettings(apps, auth.session.sub));
  } catch (error) {
    const errorMessages: Record<string, string> = {
      INVALID_PLATFORM_APP_ID: '应用 ID 无效。',
      INVALID_PLATFORM_APP_HREF: '应用地址无效，必须使用站内路径。',
      INVALID_PLATFORM_APP_TITLE: '应用名称不能为空且不能超过 100 个字符。',
      INVALID_PLATFORM_APP_DESCRIPTION: '应用说明不能超过 500 个字符。',
      INVALID_PLATFORM_APP_ICON: '应用图标无效。',
      INVALID_PLATFORM_APP_STATE: '应用状态无效。',
      INVALID_PLATFORM_APP_ACCESS: '应用访问范围无效。',
      DUPLICATE_PLATFORM_APP_ID: '应用 ID 重复。',
      DUPLICATE_PLATFORM_APP_HREF: '应用地址重复。',
      INVALID_PLATFORM_APP_PARENT: '应用父级无效。',
      NESTED_PLATFORM_APP: '只支持一级父应用和一级子应用。',
    };
    if (error instanceof Error && error.message in errorMessages) {
      return NextResponse.json({ error: errorMessages[error.message] }, { status: 400 });
    }
    console.error('[admin/platform-apps:PUT]', error);
    return NextResponse.json({ error: '保存平台应用配置失败。' }, { status: 500 });
  }
}
