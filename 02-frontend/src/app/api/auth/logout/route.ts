// POST /api/auth/logout — 登出 (F2.S5)
import { NextResponse } from 'next/server';
import { destroySession } from '@/platform/auth/auth.config';

export async function POST(request: Request) {
  await destroySession();
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
