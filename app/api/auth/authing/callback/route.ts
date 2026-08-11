import { NextRequest, NextResponse } from 'next/server';
import { mapAuthingClaims } from '@/platform/auth/authing.claims';
import {
  authingConfig,
  authingRedirectUri,
  discoverAuthing,
  exchangeAuthingCode,
  fetchAuthingUserInfo,
  safeAuthingReturnPath,
  verifyAuthingIdToken,
} from '@/platform/auth/authing.oidc';
import { authingEnabled } from '@/platform/auth/authing.config';
import { createSession } from '@/platform/auth/auth.config';
import { ExternalIdentityError, upsertAuthingUser } from '@/platform/auth/external-users';
import { recordAuthLoginEvent, safeAuthErrorParams } from '@/platform/auth/login-audit';

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
  const errorParams = safeAuthErrorParams(request.nextUrl);
  if (!authingEnabled()) {
    await recordAuthLoginEvent({
      request,
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      errorCode: 'authing_config',
      errorMessage: 'Authing 配置不完整',
      errorParams,
    });
    return redirectFailure('authing_config');
  }

  const jar = request.cookies;
  const returnTo = safeAuthingReturnPath(jar.get('authing_return_to')?.value);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const verifier = jar.get('authing_verifier')?.value;
  const expectedState = jar.get('authing_state')?.value;
  const nonce = jar.get('authing_nonce')?.value;

  if (!code || !state || !verifier || !expectedState || state !== expectedState || !nonce) {
    await recordAuthLoginEvent({
      request,
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      errorCode: 'authing_state',
      errorMessage: 'Authing 回调缺少必要参数或 state 校验失败',
      errorParams,
    });
    return redirectFailure('authing_state');
  }

  let username: string | null = null;
  let displayName: string | null = null;
  let userId: string | null = null;
  let authingData: unknown = null;
  try {
    const config = authingConfig();
    const discovery = await discoverAuthing(config.issuer);
    const redirectUri = authingRedirectUri(request.url);
    const { idToken, accessToken } = await exchangeAuthingCode({
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
    authingData = { idTokenClaims: claims };

    const mergedClaims = { ...claims };
    let userInfoClaims: Record<string, unknown> | null = null;
    if (accessToken) {
      try {
        userInfoClaims = await fetchAuthingUserInfo({
          userinfoEndpoint: discovery.userinfo_endpoint,
          accessToken,
        });
        console.info('[authing] userinfo claims received', {
          keys: Object.keys(userInfoClaims).sort(),
          sub: userInfoClaims.sub ?? null,
          unionid: userInfoClaims.unionid ?? null,
          external_id: userInfoClaims.external_id ?? null,
        });
      } catch (error) {
        console.warn(
          '[authing] userinfo fetch failed; continue with id_token claims',
          error instanceof Error ? error.message : String(error),
        );
      }

      if (
        userInfoClaims &&
        typeof userInfoClaims.sub === 'string' &&
        userInfoClaims.sub !== claims.sub
      ) {
        throw new Error('Authing userinfo sub 不匹配');
      }

      for (const [key, value] of Object.entries(userInfoClaims ?? {})) {
        if (mergedClaims[key] === undefined || mergedClaims[key] === null || mergedClaims[key] === '') {
          mergedClaims[key] = value;
        }
      }
    } else {
      console.warn('[authing] token response has no access_token; skip userinfo');
    }
    authingData = {
      idTokenClaims: claims,
      userInfoClaims,
      mergedClaims,
    };

    const identity = mapAuthingClaims(config.issuer, mergedClaims);
    username = identity.username;
    displayName = identity.name;
    const user = await upsertAuthingUser(identity);
    userId = user.id;

    await createSession({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      platformRole: user.platformRole,
    });
    await recordAuthLoginEvent({
      request,
      provider: 'authing',
      stage: 'callback',
      outcome: 'success',
      username: user.username,
      displayName: user.displayName,
      userId: user.id,
      errorParams,
    });

    const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '');
    const response = NextResponse.redirect(
      baseUrl ? new URL(returnTo, `${baseUrl}/`).toString() : returnTo,
    );
    for (const cookie of TRANSIENT_COOKIES) response.cookies.delete(cookie);
    return response;
  } catch (error) {
    console.error('[authing] callback failed', error);
    const errorCode = failureCode(error);
    await recordAuthLoginEvent({
      request,
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      username,
      displayName,
      userId,
      errorCode,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorParams,
      authingData,
    });
    return redirectFailure(errorCode);
  }
}
