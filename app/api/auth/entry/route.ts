import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { authingEnabled, authingRequired } from '@/platform/auth/authing.config';
import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';
import { getRequestUrl } from '@/platform/auth/request-url';
import { resolveReturnPath } from '@/platform/auth/return-path';

/**
 * GET /api/auth/entry?next=/ai-resources/review/xxx
 * - Already logged in → redirect to next
 * - Otherwise → start Authing OIDC, then return to next
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = resolveReturnPath(url.searchParams.get('next'), DEFAULT_AFTER_LOGIN);

  const session = await getSession();
  if (session) {
    return NextResponse.redirect(getRequestUrl(request, next), { status: 303 });
  }

  if (!authingEnabled()) {
    return NextResponse.redirect(
      getRequestUrl(
        request,
        authingRequired() ? '/login?error=authing_config' : '/login',
      ),
      { status: 303 },
    );
  }

  const authingUrl = getRequestUrl(request, '/api/auth/authing');
  authingUrl.searchParams.set('next', next);
  return NextResponse.redirect(authingUrl, { status: 303 });
}
