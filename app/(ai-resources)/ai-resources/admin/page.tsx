import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BellRing, DatabaseZap, ShieldUser, TableProperties } from 'lucide-react';
import { db } from '@/lib/database';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';

export default async function AdminPage() {
  try {
    const actor = await requireAiResourceRole('admin');
    const resourceCount = await db.aiResource.count();

    return (
      <main className="main">
        <p className="subtle" style={{ marginBottom: 16 }}>
          管理员：{actor.username}
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

          <Link className="admin-feature-card" href="/ai-resources/admin/roles">
            <span className="admin-feature-icon">
              <ShieldUser size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>角色管理</strong>
              <span>分配模块管理员、审批人与普通成员角色。</span>
            </span>
            <span className="admin-feature-action">进入</span>
          </Link>

          <Link className="admin-feature-card" href="/ai-resources/admin/dingtalk">
            <span className="admin-feature-icon">
              <BellRing size={24} />
            </span>
            <span className="admin-feature-body">
              <strong>钉钉通知</strong>
              <span>配置审批待办与资源上线工作通知（应用内正式通道）。</span>
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
