import Link from 'next/link';
import { ArrowLeft, PlugZap } from 'lucide-react';
import PlatformIntegrationsPage from '@/components/platform/platform-integrations-page';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';

export default async function PlatformIntegrationsRoute() {
  await requireSystemAdminPage('/portal/platform-admin/integrations');

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-[900px] px-5 py-8">
        <header className="mb-6">
          <Link
            href="/portal/platform-admin"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            平台后台管理
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <PlugZap className="h-4 w-4" />
            Platform / External integrations
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">外挂应用连接</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理独立部署应用的入口地址和服务端 SSO 兑换连接。
          </p>
        </header>
        <PlatformIntegrationsPage />
      </div>
    </div>
  );
}
