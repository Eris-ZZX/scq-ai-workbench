import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BellRing, DatabaseZap, FileClock, LayoutDashboard, TableProperties } from 'lucide-react';
import { db } from '@/lib/database';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';

export default async function AdminPage() {
  try {
    const actor = await requireAiResourceRole('admin');
    const resourceCount = await db.aiResource.count();

    return (
      <main className="main">
        <p className="subtle" style={{ marginBottom: 16 }}>
          管理员：{actor.displayName}
        </p>
        <section className="admin-feature-grid">
          <Link className="admin-feature-card" href="/ai-resources/admin/dashboard">
            <span className="admin-feature-icon">
              <LayoutDashboard size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>资源看板</strong>
              <span>查看资源状态、审批趋势、热门资源和待处理事项。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>

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

          <Link className="admin-feature-card" href="/ai-resources/admin/notifications">
            <span className="admin-feature-icon">
              <BellRing size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>外部通知 / DWS</strong>
              <span>配置审批待办与资源上线通知，并查看 Worker 状态。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>

          <Link className="admin-feature-card" href="/ai-resources/admin/audit-logs">
            <span className="admin-feature-icon">
              <FileClock size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>日志审计</strong>
              <span>查询资源、审批、权限和通知配置的详细变更记录。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}
