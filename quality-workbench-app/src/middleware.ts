// src/middleware.ts — Next.js 全局中间件入口
import { authMiddleware } from '@/platform/auth/middleware';

export function middleware(request: import('next/server').NextRequest) {
  return authMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|login|register|api/auth).*)'],
};
