import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderKanban, Library, ShieldCheck } from 'lucide-react';
import { getSession } from '@/platform/auth/auth.config';

export default async function PortalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">选择要进入的应用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            已登录为 {session.displayName} · 供应链质量部统一入口
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

          <Link
            href="/workbench"
            className="rounded-lg border border-border bg-white p-6 shadow-sm transition hover:border-primary"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="text-lg font-semibold text-foreground">质量工作台</div>
            <p className="mt-2 text-sm text-muted-foreground">项目活动、待办与 NPQ 流程管理（测试）</p>
          </Link>

          {session.platformRole === 'admin' ? (
            <Link
              href="/portal/users"
              className="rounded-lg border border-border bg-white p-6 shadow-sm transition hover:border-primary"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-foreground">用户与权限管理</div>
              <p className="mt-2 text-sm text-muted-foreground">统一维护平台账号、角色、岗位和项目权限</p>
            </Link>
          ) : null}
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
