import { NextRequest, NextResponse } from 'next/server';
import {
  authingConfig,
  authingRedirectUri,
  buildAuthingAuthorizationUrl,
  discoverAuthing,
  pkceChallenge,
  randomToken,
  safeAuthingReturnPath,
} from '@/platform/auth/authing.oidc';

export const runtime = 'nodejs';

const TRANSIENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 600,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

export async function GET(request: NextRequest) {
  const returnTo = safeAuthingReturnPath(request.nextUrl.searchParams.get('next'));

  try {
    const config = authingConfig();
    const discovery = await discoverAuthing(config.issuer);
    const verifier = randomToken();
    const state = randomToken();
    const nonce = randomToken();
    const redirectUri = authingRedirectUri(request.url);
    const authorizationUrl = buildAuthingAuthorizationUrl({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.clientId,
      redirectUri,
      state,
      nonce,
      codeChallenge: pkceChallenge(verifier),
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set('authing_verifier', verifier, TRANSIENT_COOKIE_OPTIONS);
    response.cookies.set('authing_state', state, TRANSIENT_COOKIE_OPTIONS);
    response.cookies.set('authing_nonce', nonce, TRANSIENT_COOKIE_OPTIONS);
    response.cookies.set('authing_return_to', returnTo, TRANSIENT_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('[authing] login initiation failed', error);
    return NextResponse.redirect(
      new URL('/login?error=authing_config', request.url),
    );
  }
}
