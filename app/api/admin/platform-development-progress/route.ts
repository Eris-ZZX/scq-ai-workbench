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
    projects?: unknown[];
  } | null;
  if (!Array.isArray(body?.projects)) {
    return NextResponse.json({ error: '缺少开发项目配置。' }, { status: 400 });
  }

  const items = body.projects.map((item) => {
    const value = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : {};
    return {
      id: value.id,
      categoryId: value.categoryId,
      name: value.name,
      progressPercent: value.progressPercent,
      ownerId: value.ownerId,
      note: value.note,
    };
  });

  try {
    return NextResponse.json(
      await savePlatformDevelopmentSettings(items, auth.session.sub),
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PLATFORM_PROGRESS_CATEGORY') {
      return NextResponse.json({ error: '平台开发进度分类无效。' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'EMPTY_PLATFORM_PROGRESS_PROJECT') {
      return NextResponse.json({ error: '开发项目名称不能为空。' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'DUPLICATE_PLATFORM_PROGRESS_PROJECT') {
      return NextResponse.json({ error: '开发项目 ID 重复。' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_PLATFORM_PROGRESS_OWNER') {
      return NextResponse.json({ error: '平台开发进度负责人无效。' }, { status: 400 });
    }
    console.error('[admin/platform-development-progress:PUT]', error);
    return NextResponse.json({ error: '保存平台开发进度失败。' }, { status: 500 });
  }
}
