import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { recordAuthLoginEvent } from '@/platform/auth/login-audit';
import { getDrawingReliabilityConnection } from '@/platform/sso/external-connection';
import {
  consumeLaunchCode,
  DRAWING_RELIABILITY_APP_ID,
} from '@/platform/sso/launch-code';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function safeSecretEquals(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function bearerSecret(request: Request) {
  const value = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() ?? '';
}

async function auditExchange(
  request: Request,
  outcome: 'success' | 'failure',
  input: { userId?: string; username?: string; errorCode?: string },
) {
  await recordAuthLoginEvent({
    request,
    provider: 'sqm-sso',
    stage: 'credentials',
    outcome,
    userId: input.userId,
    username: input.username,
    errorCode: input.errorCode,
  });
}

export async function POST(request: Request) {
  let connection;
  try {
    connection = await getDrawingReliabilityConnection();
  } catch (error) {
    console.error('[platform-sso] external connection configuration cannot be read', error);
    await auditExchange(request, 'failure', { errorCode: 'sso_not_configured' });
    return json({ error: 'SSO exchange is not configured' }, 503);
  }

  const configuredSecret = connection.exchangeSecret.trim();
  if (!connection.enabled || !configuredSecret) {
    await auditExchange(request, 'failure', { errorCode: 'sso_not_configured' });
    return json({ error: 'SSO exchange is not configured' }, 503);
  }

  const clientId = DRAWING_RELIABILITY_APP_ID;
  if (
    request.headers.get('x-qe-sso-client-id') !== clientId ||
    !safeSecretEquals(bearerSecret(request), configuredSecret)
  ) {
    await auditExchange(request, 'failure', { errorCode: 'invalid_client_credentials' });
    return json({ error: 'invalid client credentials' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    await auditExchange(request, 'failure', { errorCode: 'invalid_request_body' });
    return json({ error: 'invalid request body' }, 400);
  }

  const appId = typeof body.appId === 'string' ? body.appId.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (appId !== DRAWING_RELIABILITY_APP_ID || !code) {
    await auditExchange(request, 'failure', { errorCode: 'invalid_launch_request' });
    return json({ error: 'invalid launch request' }, 400);
  }

  const consumed = await consumeLaunchCode(code, appId);
  if (!consumed) {
    await auditExchange(request, 'failure', { errorCode: 'launch_code_rejected' });
    return json({ error: 'launch code expired or already consumed' }, 401);
  }

  const user = await db.user.findUnique({
    where: { id: consumed.subjectUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      platformRole: true,
      status: true,
    },
  });
  if (!user || user.status !== 'active') {
    await auditExchange(request, 'failure', {
      userId: user?.id,
      username: user?.username,
      errorCode: 'user_inactive',
    });
    return json({ error: 'user is not active' }, 401);
  }

  await auditExchange(request, 'success', {
    userId: user.id,
    username: user.username,
  });
  console.info('[platform-sso] launch code redeemed', {
    appId,
    userId: user.id,
  });

  return json({
    appId,
    sub: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || null,
    role: user.role,
    platformRole: user.platformRole,
  }, 200);
}

export async function GET(request: Request) {
  let connection;
  try {
    connection = await getDrawingReliabilityConnection();
  } catch (error) {
    console.error('[platform-sso] external connection configuration cannot be read', error);
    await auditExchange(request, 'failure', { errorCode: 'sso_not_configured' });
    return json({ error: 'SSO exchange is not configured' }, 503);
  }

  const configuredSecret = connection.exchangeSecret.trim();
  if (!connection.enabled || !configuredSecret) {
    await auditExchange(request, 'failure', { errorCode: 'sso_not_configured' });
    return json({ error: 'SSO exchange is not configured' }, 503);
  }
  if (
    request.headers.get('x-qe-sso-client-id') !== DRAWING_RELIABILITY_APP_ID
    || !safeSecretEquals(bearerSecret(request), configuredSecret)
  ) {
    await auditExchange(request, 'failure', { errorCode: 'invalid_client_credentials' });
    return json({ error: 'invalid client credentials' }, 401);
  }

  return json({
    ok: true,
    appId: DRAWING_RELIABILITY_APP_ID,
  }, 200);
}
