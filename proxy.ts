// Next.js 16 全局代理入口。仅依赖 Edge-safe 的 JWT 验签代码。
import { authMiddleware } from '@/platform/auth/middleware';

export function proxy(request: import('next/server').NextRequest) {
  return authMiddleware(request);
}

export const config = {
  // Upload/import handlers authenticate themselves. Excluding them here avoids
  // Next Proxy's body clone/truncation path (10 MB by default) for large files.
  matcher: [
    '/((?!_next|favicon.ico|login|api/auth|api/ai-resources/uploads|api/ai-resources/admin/resources/import|api/npq/activities/children/[^/]+/attachments).*)',
  ],
};
