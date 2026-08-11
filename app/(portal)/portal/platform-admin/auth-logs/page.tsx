import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';
import AuthLoginLogsPage from './auth-login-logs-page';

export default async function PlatformAuthLogsRoute() {
  await requireSystemAdminPage('/portal/platform-admin/auth-logs');

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
            <LogIn className="h-4 w-4" />
            Platform / Login Audit
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">登录日志</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看 Authing、钉钉和账号密码登录行为，导出单条脱敏详情协助排查。
          </p>
        </header>
        <AuthLoginLogsPage />
      </div>
    </div>
  );
}
