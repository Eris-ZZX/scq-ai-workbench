import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseList } from '@/modules/ai-resources/list-fields';
import { AdminResourceActions } from '@/modules/ai-resources/ui/admin-resource-actions';

export default async function AdminResourcesPage() {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  const resources = await prisma.aiResource.findMany({
    include: { createdBy: { select: { username: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  return (
    <main className="main">
      <section className="page-head compact">
        <div className="meta">
          <Link className="button" href="/ai-resources/admin">
            返回后台
          </Link>
          <Link className="button primary" href="/ai-resources/new">
            新增资源
          </Link>
        </div>
      </section>

      <section className="panel admin-detail-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>资源名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>适用小组</th>
                <th>负责人</th>
                <th>版本</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <Link className="admin-resource-name" href={`/ai-resources/${resource.id}`}>
                      {resource.name}
                    </Link>
                    <span className="subtle">创建人：{resource.createdBy.username}</span>
                  </td>
                  <td>{resourceTypeLabel[resource.type as AiResourceType] ?? resource.type}</td>
                  <td>{resource.status}</td>
                  <td>{parseList(resource.tags).join('、') || '未设置'}</td>
                  <td>{resource.ownerName}</td>
                  <td>v{resource.currentVersion}</td>
                  <td>{formatDate(resource.updatedAt)}</td>
                  <td>
                    <AdminResourceActions
                      resourceId={resource.id}
                      resourceName={resource.name}
                      status={resource.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
