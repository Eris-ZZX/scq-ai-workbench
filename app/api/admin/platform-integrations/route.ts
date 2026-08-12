import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  ExternalConnectionError,
  getDrawingReliabilityConnectionView,
  saveDrawingReliabilityConnection,
  testDrawingReliabilityConnection,
} from '@/platform/sso/external-connection';
import { logEvent } from '@/lib/platform/observability/logger';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

function auditTraceId(request: Request) {
  return request.headers.get('x-trace-id') || randomUUID();
}

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    return NextResponse.json({
      connection: await getDrawingReliabilityConnectionView(),
    });
  } catch (error) {
    console.error('[admin/platform-integrations:GET]', error);
    return NextResponse.json({ error: '外挂应用连接配置读取失败。' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null) as {
    launchUrl?: unknown;
    note?: unknown;
    exchangeSecret?: unknown;
    enabled?: unknown;
  } | null;

  if (typeof body?.launchUrl !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '外挂应用连接参数不完整。' }, { status: 400 });
  }

  try {
    const connection = await saveDrawingReliabilityConnection({
      launchUrl: body.launchUrl,
      note: typeof body.note === 'string' ? body.note : '',
      exchangeSecret: typeof body.exchangeSecret === 'string'
        ? body.exchangeSecret
        : '',
      enabled: body.enabled,
      updatedByUserId: auth.session.sub,
    });

    void logEvent({
      traceId: auditTraceId(request),
      eventType: 'user_action',
      path: '/api/admin/platform-integrations',
      method: 'PUT',
      userId: auth.session.sub,
      statusCode: 200,
      responseSummary: `updated ${connection.appId}; enabled=${connection.enabled}; secretConfigured=${connection.secretConfigured}`,
    }).catch(() => undefined);

    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof ExternalConnectionError) {
      const status = error.code === 'EXTERNAL_APP_SECRET_REQUIRED' ? 400 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('[admin/platform-integrations:PUT]', error);
    return NextResponse.json({ error: '外挂应用连接配置保存失败。' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await testDrawingReliabilityConnection();
    void logEvent({
      traceId: auditTraceId(request),
      eventType: 'user_action',
      path: '/api/admin/platform-integrations',
      method: 'POST',
      userId: auth.session.sub,
      statusCode: 200,
      responseSummary: 'tested drawing reliability connection successfully',
    }).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExternalConnectionError) {
      void logEvent({
        traceId: auditTraceId(request),
        eventType: 'user_action',
        path: '/api/admin/platform-integrations',
        method: 'POST',
        userId: auth.session.sub,
        statusCode: 502,
        responseSummary: `tested drawing reliability connection: ${error.code}`,
      }).catch(() => undefined);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[admin/platform-integrations:POST]', error);
    return NextResponse.json({ error: '外挂应用连接测试失败。' }, { status: 500 });
  }
}
