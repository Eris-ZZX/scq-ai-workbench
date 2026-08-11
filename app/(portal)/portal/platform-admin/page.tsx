import Link from 'next/link';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';

export default async function PlatformAdminPage() {
  await requireSystemAdminPage('/portal/platform-admin');

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="mb-6">
          <Link
            href="/portal"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            应用选择
          </Link>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Platform / Administration
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">平台后台管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">统一管理平台账号、权限和组织基础数据。</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/portal/platform-admin/users"
            className="rounded-md border border-border bg-white p-4 shadow-sm transition hover:border-primary"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UsersRound className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold text-foreground">用户与权限管理</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              维护平台账号、角色、岗位、项目权限和组织小组 ID 映射。
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
