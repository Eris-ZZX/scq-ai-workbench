// platform/auth/middleware.ts — 认证中间件 (F2.S4)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { AUTH_CONFIG, getSecretKey } from './auth.jwt';

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

  // 🔧 CR1-2: API 路由返回 JSON 401 而非 HTML 重定向
  const isApi = pathname.startsWith('/api/');

  if (!token) {
    if (isApi) return NextResponse.json({ error: '未登录' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    // 🔧 将已验证的 payload 注入请求头，避免页面层重复验证
    const res = NextResponse.next();
    res.headers.set('x-user-id', payload.sub as string);
    res.headers.set('x-user-role', (payload.role as string) ?? 'user');

    return res;
  } catch {
    if (isApi) return NextResponse.json({ error: '会话已过期' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// config re-exported from src/middleware.ts (Next.js requires inline config in same file)
