import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DatabaseZap, TableProperties } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getMaintenanceMode } from '@/modules/ai-resources/maintenance';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';
import { AdminMembershipPanel } from '@/modules/ai-resources/ui/admin-membership-panel';
import { AdminMaintenanceToggle } from '@/modules/ai-resources/ui/admin-maintenance-toggle';

export default async function AdminPage() {
  try {
    const actor = await requireAiResourceRole('admin');
    const [resourceCount, maintenanceMode] = await Promise.all([
      prisma.aiResource.count(),
      getMaintenanceMode(),
    ]);

    return (
      <main className="main">
        <p className="subtle" style={{ marginBottom: 16 }}>
          管理员：{actor.username} · 维护模式：{maintenanceMode ? '开启' : '关闭'}
        </p>
        <section className="admin-feature-grid">
          <Link className="admin-feature-card" href="/ai-resources/admin/import">
            <span className="admin-feature-icon">
              <DatabaseZap size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>批量导入</strong>
              <span>通过 Excel 批量创建资源，导入后直接发布并生成更新记录。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>

          <Link className="admin-feature-card" href="/ai-resources/admin/resources">
            <span className="admin-feature-icon">
              <TableProperties size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>资源维护</strong>
              <span>修改、归档和恢复已有资源。当前共 {resourceCount} 条资源。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>
        </section>

        <AdminMaintenanceToggle initialEnabled={maintenanceMode} />
        <AdminMembershipPanel />
      </main>
    );
  } catch {
    notFound();
  }
}
