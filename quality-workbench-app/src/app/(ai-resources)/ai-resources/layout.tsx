import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';
import { isAiResourcesEnabled } from '@/modules/ai-resources/config';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import '@/modules/ai-resources/ui/styles.css';

export default async function AiResourcesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!isAiResourcesEnabled()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
        <div className="max-w-md rounded-lg border border-border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">AI 资源库未启用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            请完成数据迁移并将 AI_RESOURCES_ENABLED 设为 true 后再访问。
          </p>
          <Link href="/portal" className="mt-4 inline-block text-sm text-primary hover:underline">
            返回应用选择
          </Link>
        </div>
      </div>
    );
  }

  await requireAiResourceUser();

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4 text-sm">
            <Link href="/ai-resources" className="font-semibold text-foreground">
              AI 资源库
            </Link>
            <Link href="/ai-resources" className="text-muted-foreground hover:text-foreground">
              目录
            </Link>
            <Link href="/ai-resources/new" className="text-muted-foreground hover:text-foreground">
              上传
            </Link>
            <Link href="/ai-resources/favorites" className="text-muted-foreground hover:text-foreground">
              收藏
            </Link>
            <Link href="/ai-resources/review" className="text-muted-foreground hover:text-foreground">
              审批
            </Link>
            <Link href="/ai-resources/admin" className="text-muted-foreground hover:text-foreground">
              模块管理
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{session.username}</span>
            <Link href="/portal" className="text-primary hover:underline">
              返回应用选择
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                退出
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="ai-resources-shell">{children}</div>
    </div>
  );
}
