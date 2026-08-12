import Link from 'next/link';
import { AppWindow, ArrowLeft } from 'lucide-react';
import PlatformAppsPage from '@/components/platform/platform-apps-page';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';

export default async function PlatformAppsRoute() {
  await requireSystemAdminPage('/portal/platform-admin/apps');

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-[1500px] px-5 py-8">
        <header className="mb-6">
          <Link
            href="/portal/platform-admin"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            平台后台管理
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <AppWindow className="h-4 w-4" />
            Platform / Applications
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">应用管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理门户应用、父子层级、入口地址和访问范围。
          </p>
        </header>
        <PlatformAppsPage />
      </div>
    </div>
  );
}
