import { NextResponse } from 'next/server';

/** Legacy callback retained only to return an explicit migration response. */
export function GET(request: Request) {
  return NextResponse.redirect(
    new URL('/login?error=authing_config', request.url),
    { status: 303 },
  );
}
