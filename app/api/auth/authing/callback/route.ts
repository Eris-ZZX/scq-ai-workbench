import { NextRequest, NextResponse } from 'next/server';
import { mapAuthingClaims } from '@/platform/auth/authing.claims';
import {
  authingConfig,
  authingRedirectUri,
  discoverAuthing,
  exchangeAuthingCode,
  safeAuthingReturnPath,
  verifyAuthingIdToken,
} from '@/platform/auth/authing.oidc';
import { authingEnabled } from '@/platform/auth/authing.config';
import { createSession } from '@/platform/auth/auth.config';
import { ExternalIdentityError, upsertAuthingUser } from '@/platform/auth/external-users';

export const runtime = 'nodejs';

const TRANSIENT_COOKIES = [
  'authing_verifier',
  'authing_state',
  'authing_nonce',
  'authing_return_to',
] as const;

function failureCode(error: unknown) {
  if (error instanceof ExternalIdentityError && error.code === 'disabled') return 'disabled';
  if (error instanceof ExternalIdentityError && error.code === 'conflict') return 'identity_conflict';
  return 'authing';
}

function redirectFailure(code: string) {
  // 用 APP_BASE_URL 作为重定向基准：容器内 request.url 的 host 是 0.0.0.0，
  // 直接基于它拼 URL 会把用户带向无法访问的 0.0.0.0:3000。
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '');
  const response = NextResponse.redirect(
    baseUrl ? `${baseUrl}/login?error=${encodeURIComponent(code)}` : `/login?error=${encodeURIComponent(code)}`,
  );
  for (const cookie of TRANSIENT_COOKIES) response.cookies.delete(cookie);
  return response;
}

export async function GET(request: NextRequest) {
  if (!authingEnabled()) return redirectFailure('authing_config');

  const jar = request.cookies;
  const returnTo = safeAuthingReturnPath(jar.get('authing_return_to')?.value);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const verifier = jar.get('authing_verifier')?.value;
  const expectedState = jar.get('authing_state')?.value;
  const nonce = jar.get('authing_nonce')?.value;

  if (!code || !state || !verifier || !expectedState || state !== expectedState || !nonce) {
    return redirectFailure('authing_state');
  }

  try {
    const config = authingConfig();
    const discovery = await discoverAuthing(config.issuer);
    const redirectUri = authingRedirectUri(request.url);
    const idToken = await exchangeAuthingCode({
      config,
      tokenEndpoint: discovery.token_endpoint,
      code,
      codeVerifier: verifier,
      redirectUri,
    });
    const claims = await verifyAuthingIdToken({
      idToken,
      config,
      jwksUri: discovery.jwks_uri,
      nonce,
    });
    const identity = mapAuthingClaims(config.issuer, claims);
    const user = await upsertAuthingUser(identity);

    await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
      platformRole: user.platformRole,
    });

    const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '');
    const response = NextResponse.redirect(
      baseUrl ? new URL(returnTo, `${baseUrl}/`).toString() : returnTo,
    );
    for (const cookie of TRANSIENT_COOKIES) response.cookies.delete(cookie);
    return response;
  } catch (error) {
    console.error('[authing] callback failed', error);
    return redirectFailure(failureCode(error));
  }
}
