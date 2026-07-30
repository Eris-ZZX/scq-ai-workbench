// GET /api/auth/dingtalk — 钉钉 OAuth2.0 扫码登录入口（新版端点）
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { AUTH_RETURN_COOKIE, resolveReturnPath } from '@/platform/auth/return-path';

const STATE_COOKIE = 'dingtalk_oauth_state';

function getDingTalkConfig() {
  const clientId = process.env.DINGTALK_CLIENT_ID;
  const clientSecret = process.env.DINGTALK_CLIENT_SECRET;
  const redirectUri = process.env.DINGTALK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

export async function GET(request: Request) {
  const config = getDingTalkConfig();
  if (!config) {
    return NextResponse.json(
      { error: '钉钉登录未配置' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const next = resolveReturnPath(url.searchParams.get('next'));

  const state = crypto.randomBytes(32).toString('hex');

  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  jar.set(AUTH_RETURN_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid',
    state,
    prompt: 'consent',
  });

  return NextResponse.redirect(
    `https://login.dingtalk.com/oauth2/auth?${params.toString()}`,
  );
}
