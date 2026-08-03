import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/platform/auth/auth.config';
import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';
import { getRequestUrl } from '@/platform/auth/request-url';
import { AUTH_RETURN_COOKIE, resolveReturnPath } from '@/platform/auth/return-path';
import { defaultSecureCookie } from '@/platform/auth/auth.jwt';

/**
 * GET /api/auth/entry?next=/ai-resources/review/xxx
 * - Already logged in → redirect to next
 * - Otherwise → start DingTalk OAuth, then return to next
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = resolveReturnPath(url.searchParams.get('next'), DEFAULT_AFTER_LOGIN);

  const session = await getSession();
  if (session) {
    return NextResponse.redirect(getRequestUrl(request, next), { status: 303 });
  }

  const jar = await cookies();
  jar.set(AUTH_RETURN_COOKIE, next, {
    httpOnly: true,
    secure: defaultSecureCookie(),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const dingtalkUrl = getRequestUrl(request, '/api/auth/dingtalk');
  dingtalkUrl.searchParams.set('next', next);
  return NextResponse.redirect(dingtalkUrl, { status: 303 });
}
