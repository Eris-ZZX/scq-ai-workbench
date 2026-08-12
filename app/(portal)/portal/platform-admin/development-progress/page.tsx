import Link from 'next/link';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import PlatformDevelopmentProgressPage from '@/components/platform/platform-development-progress-page';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';

export default async function PlatformDevelopmentProgressRoute() {
  await requireSystemAdminPage('/portal/platform-admin/development-progress');

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="mb-6">
          <Link
            href="/portal/platform-admin"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            平台后台管理
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Platform / Development Progress
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">平台应用开发进度</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            配置平台基础设施和各类应用在用户端进度面板中的展示信息。
          </p>
        </header>
        <PlatformDevelopmentProgressPage />
      </div>
    </div>
  );
}
