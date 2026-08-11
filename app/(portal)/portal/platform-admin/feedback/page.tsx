import Link from 'next/link';
import { ArrowLeft, MessageSquareText } from 'lucide-react';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';
import PlatformFeedbackPage from './platform-feedback-page';

export default async function PlatformFeedbackRoute() {
  await requireSystemAdminPage('/portal/platform-admin/feedback');

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
            <MessageSquareText className="h-4 w-4" />
            Platform / Feedback Logs
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">反馈日志</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看平台用户提交的问题、建议和截图。</p>
        </header>
        <PlatformFeedbackPage />
      </div>
    </div>
  );
}
