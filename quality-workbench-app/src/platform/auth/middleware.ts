// platform/auth/middleware.ts — 认证中间件 (F2.S4)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { AUTH_CONFIG, COOKIE_NAME, getSecretKey } from './auth.jwt';
import { getRequestUrl } from './request-url';

// 无需认证即可访问的路径前缀
const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路由直接放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 静态资源放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_CONFIG.cookieName)?.value;

  // API 路由返回 JSON 401 而非 HTML 重定向
  const isApi = pathname.startsWith('/api/');

  if (!token) {
    if (isApi) return NextResponse.json({ error: '未登录' }, { status: 401 });
    return NextResponse.redirect(getRequestUrl(request, '/login'));
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    const res = NextResponse.next();
    res.headers.set('x-user-id', encodeURIComponent(String(payload.sub ?? '')));
    res.headers.set('x-user-role', encodeURIComponent(String(payload.role ?? 'user')));

    return res;
  } catch {
    if (isApi) return NextResponse.json({ error: '会话已过期' }, { status: 401 });
    const res = NextResponse.redirect(getRequestUrl(request, '/login'));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}
