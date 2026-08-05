import { NextResponse } from 'next/server';

/**
 * Legacy compatibility endpoint. DingTalk OAuth is intentionally disabled:
 * company policy no longer provides DingTalk application credentials.
 */
export function GET(request: Request) {
  const url = new URL('/login?error=authing_config', request.url);
  return NextResponse.redirect(url, { status: 303 });
}
