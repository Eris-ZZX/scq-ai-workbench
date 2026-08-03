// POST /api/auth/logout — 登出 (F2.S5)
import { NextResponse } from 'next/server';
import { destroySession } from '@/platform/auth/auth.config';
import { getRequestUrl } from '@/platform/auth/request-url';

export async function POST(request: Request) {
  await destroySession();
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    return NextResponse.redirect(getRequestUrl(request, '/login'), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
