import { NextResponse } from 'next/server';
import {
  getPlatformDevelopmentSettings,
  savePlatformDevelopmentSettings,
} from '@/lib/platform/development-progress';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(await getPlatformDevelopmentSettings());
}

export async function PUT(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null) as {
    items?: Array<{
      id?: unknown;
      progressPercent?: unknown;
      ownerId?: unknown;
      note?: unknown;
    }>;
  } | null;
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: '缺少平台开发进度配置。' }, { status: 400 });
  }

  const items = body.items.map((item) => ({
    id: typeof item.id === 'string' ? item.id.trim() : '',
    progressPercent: item.progressPercent,
    ownerId: item.ownerId,
    note: item.note,
  }));

  try {
    return NextResponse.json(
      await savePlatformDevelopmentSettings(items, auth.session.sub),
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PLATFORM_PROGRESS_ITEM') {
      return NextResponse.json({ error: '平台开发进度项目无效。' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_PLATFORM_PROGRESS_OWNER') {
      return NextResponse.json({ error: '平台开发进度负责人无效。' }, { status: 400 });
    }
    console.error('[admin/platform-development-progress:PUT]', error);
    return NextResponse.json({ error: '保存平台开发进度失败。' }, { status: 500 });
  }
}
