import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  deleteExternalAppConnection,
  ExternalConnectionError,
  saveExternalAppConnection,
  testExternalAppConnection,
} from '@/platform/sso/external-connection';
import {
  getPlatformAppAdminSettings,
} from '@/lib/platform/apps/admin';
import {
  getPlatformAppRecords,
  savePlatformAppSettings,
  type PlatformAppRegistryInput,
} from '@/lib/platform/apps/registry';
import { logEvent } from '@/lib/platform/observability/logger';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

const REGISTRY_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PLATFORM_APP_ID: '应用 ID 无效。',
  INVALID_PLATFORM_APP_HREF: '应用内部入口无效，必须使用站内路径。',
  INVALID_PLATFORM_APP_TITLE: '应用名称不能为空且不能超过 100 个字符。',
  INVALID_PLATFORM_APP_DESCRIPTION: '应用说明不能超过 500 个字符。',
  INVALID_PLATFORM_APP_ICON: '应用图标无效。',
  INVALID_PLATFORM_APP_STATE: '应用状态无效。',
  INVALID_PLATFORM_APP_ACCESS: '应用访问范围无效。',
  INVALID_PLATFORM_APP_LAUNCH_MODE: '应用启动方式无效。',
  DUPLICATE_PLATFORM_APP_ID: '应用 ID 重复。',
  DUPLICATE_PLATFORM_APP_HREF: '应用内部入口重复。',
  INVALID_PLATFORM_APP_PARENT: '应用父级无效。',
  NESTED_PLATFORM_APP: '只支持一级父应用和一级子应用。',
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ConnectionInput = {
  launchUrl?: unknown;
  note?: unknown;
  exchangeSecret?: unknown;
  enabled?: unknown;
};

type ValidatedConnectionInput = {
  launchUrl: string;
  note: string;
  exchangeSecret: string;
  enabled: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  if (error instanceof ExternalConnectionError) return error.message;
  if (error instanceof Error && error.message in REGISTRY_ERROR_MESSAGES) {
    return REGISTRY_ERROR_MESSAGES[error.message];
  }
  return null;
}

function auditTraceId(request: Request) {
  return request.headers.get('x-trace-id') || randomUUID();
}

async function readApp(appId: string) {
  const apps = await getPlatformAppRecords();
  return {
    apps,
    app: apps.find((candidate) => candidate.id === appId),
  };
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: appId } = await context.params;
  const body = await request.json().catch(() => null) as {
    app?: unknown;
    connection?: unknown;
  } | null;
  if (!isObject(body?.app)) {
    return NextResponse.json({ error: '缺少应用配置。' }, { status: 400 });
  }

  const { apps, app: currentApp } = await readApp(appId);
  const appInput: PlatformAppRegistryInput = {
    ...body.app,
    id: appId,
  };
  const nextApps = currentApp
    ? apps.map((app) => (app.id === appId ? appInput : app))
    : [...apps, appInput];
  const hasConnection = Object.prototype.hasOwnProperty.call(body, 'connection');
  let connectionInput: ValidatedConnectionInput | null = null;
  if (appInput.launchMode !== 'internal' && hasConnection) {
    if (!isObject(body.connection)) {
      return NextResponse.json({ error: '外挂应用连接配置无效。' }, { status: 400 });
    }
    const connection = body.connection as ConnectionInput;
    if (typeof connection.launchUrl !== 'string' || typeof connection.enabled !== 'boolean') {
      return NextResponse.json({ error: '外挂应用连接参数不完整。' }, { status: 400 });
    }
    connectionInput = {
      launchUrl: connection.launchUrl,
      note: typeof connection.note === 'string' ? connection.note : '',
      exchangeSecret: typeof connection.exchangeSecret === 'string'
        ? connection.exchangeSecret
        : '',
      enabled: connection.enabled,
    };
  }

  try {
    await savePlatformAppSettings(nextApps, auth.session.sub);

    if (appInput.launchMode === 'internal') {
      if (
        currentApp
        && currentApp.launchMode !== 'internal'
        && hasConnection
      ) {
        await deleteExternalAppConnection(appId);
      }
    } else if (connectionInput) {
      await saveExternalAppConnection({
        appId,
        displayName: typeof appInput.title === 'string' ? appInput.title : appId,
        mode: appInput.launchMode as 'external-link' | 'external-sso',
        launchUrl: connectionInput.launchUrl,
        note: connectionInput.note,
        exchangeSecret: connectionInput.exchangeSecret,
        enabled: connectionInput.enabled,
        updatedByUserId: auth.session.sub,
      });
    }

    void logEvent({
      traceId: auditTraceId(request),
      eventType: 'user_action',
      path: `/api/admin/platform-apps/${appId}`,
      method: 'PUT',
      userId: auth.session.sub,
      statusCode: 200,
      responseSummary: `updated ${appId}; mode=${String(appInput.launchMode)}`,
    }).catch(() => undefined);

    return NextResponse.json(await getPlatformAppAdminSettings());
  } catch (error) {
    const message = errorMessage(error);
    if (message) return NextResponse.json({ error: message }, { status: 400 });
    console.error(`[admin/platform-apps/${appId}:PUT]`, error);
    return NextResponse.json({ error: '应用配置保存失败。' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: appId } = await context.params;
  const { apps, app } = await readApp(appId);
  if (!app) {
    return NextResponse.json({ error: '应用不存在。' }, { status: 404 });
  }
  if (app.builtin) {
    return NextResponse.json({ error: '内置应用不能删除。' }, { status: 400 });
  }

  try {
    await savePlatformAppSettings(
      apps.filter((candidate) => candidate.id !== appId),
      auth.session.sub,
    );
    if (app.launchMode !== 'internal') {
      await deleteExternalAppConnection(appId);
    }

    void logEvent({
      traceId: auditTraceId(request),
      eventType: 'user_action',
      path: `/api/admin/platform-apps/${appId}`,
      method: 'DELETE',
      userId: auth.session.sub,
      statusCode: 200,
      responseSummary: `deleted ${appId}`,
    }).catch(() => undefined);

    return NextResponse.json(await getPlatformAppAdminSettings());
  } catch (error) {
    console.error(`[admin/platform-apps/${appId}:DELETE]`, error);
    return NextResponse.json({ error: '应用删除失败。' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: appId } = await context.params;
  const { app } = await readApp(appId);
  if (!app) {
    return NextResponse.json({ error: '应用不存在。' }, { status: 404 });
  }
  if (app.launchMode === 'internal') {
    return NextResponse.json({ error: '站内应用不需要连接测试。' }, { status: 400 });
  }

  try {
    const result = await testExternalAppConnection(appId, app.launchMode);
    void logEvent({
      traceId: auditTraceId(request),
      eventType: 'user_action',
      path: `/api/admin/platform-apps/${appId}`,
      method: 'POST',
      userId: auth.session.sub,
      statusCode: 200,
      responseSummary: `tested ${appId} connection successfully`,
    }).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    const message = errorMessage(error);
    if (message) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    console.error(`[admin/platform-apps/${appId}:POST]`, error);
    return NextResponse.json({ error: '外挂应用连接测试失败。' }, { status: 500 });
  }
}
