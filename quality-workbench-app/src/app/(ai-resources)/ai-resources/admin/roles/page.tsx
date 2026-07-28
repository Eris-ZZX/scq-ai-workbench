import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';
import { AdminMembershipPanel } from '@/modules/ai-resources/ui/admin-membership-panel';

export default async function AdminRolesPage() {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  return (
    <main className="main">
      <section className="page-head roles-page-head">
        <div>
          <h1>角色管理</h1>
          <p className="subtle">分配管理员、审批人或普通成员</p>
        </div>
        <Link className="button" href="/ai-resources/admin">
          返回后台
        </Link>
      </section>

      <section className="panel admin-detail-panel roles-detail-panel">
        <AdminMembershipPanel />
      </section>
    </main>
  );
}
