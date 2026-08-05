import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';
import PlatformUsersPage from './platform-users-page';

export default async function PortalUsersPage() {
  await requireSystemAdminPage();

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/portal"
              className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              应用选择
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Platform / Users & Permissions
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">用户与权限管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              统一维护所有分支应用共用的平台用户、Authing 身份、DWS 组织信息和应用角色；项目权限请在质量工作台项目管理中维护。
            </p>
          </div>
        </header>
        <PlatformUsersPage />
      </div>
    </div>
  );
}
