import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDingTalkNotificationSettings } from '@/lib/dingtalk/settings';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';
import { AdminDingTalkPanel } from '@/modules/ai-resources/ui/admin-dingtalk-panel';

export default async function AdminDingTalkPage() {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  let initialNotifications = {
    reviewSubmitted: true,
    reviewRejected: true,
    reviewApproved: true,
    publish: true,
  };
  try {
    initialNotifications = await getDingTalkNotificationSettings();
  } catch (error) {
    console.error('[external] read notification settings on page failed:', error);
  }

  return (
    <main className="main">
      <section className="page-head roles-page-head">
        <div>
          <h1>外部通知 / 钉钉</h1>
          <p className="subtle">审批提醒、待办与资源上线工作通知</p>
        </div>
        <Link className="button" href="/ai-resources/admin">
          返回后台
        </Link>
      </section>

      <section className="panel admin-detail-panel">
        <AdminDingTalkPanel initialNotifications={initialNotifications} />
      </section>
    </main>
  );
}
