import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderKanban, Library } from 'lucide-react';
import { getSession } from '@/platform/auth/auth.config';
import { isAiResourcesEnabled } from '@/modules/ai-resources/config';

export default async function PortalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const resourcesEnabled = isAiResourcesEnabled();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">选择要进入的应用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            已登录为 {session.username} · 供应链质量部统一入口
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/workbench"
            className="rounded-lg border border-border bg-white p-6 shadow-sm transition hover:border-primary"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="text-lg font-semibold text-foreground">质量工作台</div>
            <p className="mt-2 text-sm text-muted-foreground">项目活动、待办与 NPQ 流程管理</p>
          </Link>

          {resourcesEnabled ? (
            <Link
              href="/ai-resources"
              className="rounded-lg border border-border bg-white p-6 shadow-sm transition hover:border-primary"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Library className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-foreground">AI 资源库</div>
              <p className="mt-2 text-sm text-muted-foreground">部门 AI 应用、Agent、Skill、Prompt 与规范目录</p>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-white/60 p-6 opacity-70">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Library className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-foreground">AI 资源库</div>
              <p className="mt-2 text-sm text-muted-foreground">
                尚未启用（需迁移完成并将 AI_RESOURCES_ENABLED=true）
              </p>
            </div>
          )}
        </div>

        <form action="/api/auth/logout" method="POST" className="mt-8 text-center">
          <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            退出登录
          </button>
        </form>
      </div>
    </div>
  );
}
