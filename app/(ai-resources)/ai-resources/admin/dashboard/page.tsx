import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAiResourceDashboard } from '@/modules/ai-resources/dashboard';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';
import { resourceTypeLabel, reviewTypeLabel } from '@/modules/ai-resources/labels';
import type { AiResourceType, AiReviewType } from '@/modules/ai-resources/constants';

const statusLabel: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
};

export default async function AiResourceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  const params = await searchParams;
  const requestedDays = Number(params.days ?? 30);
  const dashboard = await getAiResourceDashboard(requestedDays);
  const maxTrendValue = Math.max(
    1,
    ...dashboard.trend.map((item) => item.created + item.updated + item.approved),
  );

  return (
    <main className="main">
      <section className="page-head compact">
        <div>
          <p className="subtle">AI 资源库管理</p>
          <h1>资源运营看板</h1>
        </div>
        <div className="meta">
          {[7, 30, 90].map((days) => (
            <Link
              key={days}
              className={`button${dashboard.days === days ? ' primary' : ''}`}
              href={`/ai-resources/admin/dashboard?days=${days}`}
            >
              近 {days} 天
            </Link>
          ))}
          <Link className="button" href="/ai-resources/admin">
            返回后台
          </Link>
        </div>
      </section>

      <section className="admin-stat-grid">
        <Stat label="资源总数" value={dashboard.summary.totalResources} href="/ai-resources/admin/resources" />
        <Stat label="已发布" value={dashboard.summary.publishedResources} href="/ai-resources/admin/resources?status=PUBLISHED" />
        <Stat label="待审批" value={dashboard.summary.pendingReviews} href="/ai-resources/review" />
        <Stat label="累计浏览" value={dashboard.summary.totalViews} href="/ai-resources/admin/resources" />
        <Stat label="近期开通" value={dashboard.trend.reduce((sum, item) => sum + item.created, 0)} />
        <Stat label="近期更新" value={dashboard.trend.reduce((sum, item) => sum + item.updated, 0)} />
      </section>

      <div className="admin-dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>资源状态</h2>
              <p className="subtle">当前资源生命周期分布</p>
            </div>
          </div>
          <div className="admin-dashboard-bars">
            <DashboardBar label="草稿" value={dashboard.summary.draftResources} total={dashboard.summary.totalResources} />
            <DashboardBar label="已发布" value={dashboard.summary.publishedResources} total={dashboard.summary.totalResources} />
            <DashboardBar label="已归档" value={dashboard.summary.archivedResources} total={dashboard.summary.totalResources} />
          </div>
          <div className="admin-dashboard-summary">
            <span>已通过审批 {dashboard.summary.approvedReviews}</span>
            <span>已驳回审批 {dashboard.summary.rejectedReviews}</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>近期开通与更新</h2>
              <p className="subtle">按资源更新记录统计</p>
            </div>
          </div>
          <div className="dashboard-trend" aria-label={`近 ${dashboard.days} 天资源趋势`}>
            {dashboard.trend.map((item) => {
              const total = item.created + item.updated + item.approved;
              const height = Math.max(4, Math.round((total / maxTrendValue) * 100));
              return (
                <div className="dashboard-trend-item" key={item.date} title={`${item.date}：${total} 条记录`}>
                  <div className="dashboard-trend-column">
                    <span className="dashboard-trend-bar" style={{ height: `${height}%` }} />
                  </div>
                  <span>{item.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="admin-dashboard-summary">
            <span>新增 {dashboard.trend.reduce((sum, item) => sum + item.created, 0)}</span>
            <span>更新 {dashboard.trend.reduce((sum, item) => sum + item.updated, 0)}</span>
            <span>通过 {dashboard.trend.reduce((sum, item) => sum + item.approved, 0)}</span>
          </div>
        </section>
      </div>

      <div className="admin-dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>热门资源</h2>
              <p className="subtle">按累计浏览量排序</p>
            </div>
            <Link className="button" href="/ai-resources/admin/resources">
              资源维护
            </Link>
          </div>
          <div className="admin-dashboard-list">
            {dashboard.topResources.map((resource) => (
              <Link className="admin-dashboard-list-item" href={`/ai-resources/${resource.id}`} key={resource.id}>
                <span className="admin-dashboard-list-main">
                  <strong>{resource.name}</strong>
                  <span className="subtle">
                    {resourceTypeLabel[resource.type as AiResourceType] ?? resource.type} · {statusLabel[resource.status] ?? resource.status}
                  </span>
                </span>
                <span className="admin-dashboard-list-value">{Number(resource.viewCount ?? 0).toLocaleString('zh-CN')} 次</span>
              </Link>
            ))}
            {dashboard.topResources.length === 0 ? <div className="empty">暂无资源。</div> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>待审批事项</h2>
              <p className="subtle">按提交时间从早到晚排列</p>
            </div>
            <Link className="button" href="/ai-resources/review">
              审批中心
            </Link>
          </div>
          <div className="admin-dashboard-list">
            {dashboard.pendingReviewItems.map((review) => (
              <Link className="admin-dashboard-list-item" href={`/ai-resources/review/${review.id}`} key={review.id}>
                <span className="admin-dashboard-list-main">
                  <strong>{review.resource?.name ?? '新资源申请'}</strong>
                  <span className="subtle">
                    {reviewTypeLabel[review.type as AiReviewType] ?? review.type} · 提交人 {review.requester.username}
                  </span>
                </span>
                <span className="admin-dashboard-list-value">{review.reviewer?.username ?? '未指定'}</span>
              </Link>
            ))}
            {dashboard.pendingReviewItems.length === 0 ? <div className="empty">暂无待审批事项。</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <strong>{value.toLocaleString('zh-CN')}</strong>
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link className="admin-stat-card" href={href}>{content}</Link>
  ) : (
    <div className="admin-stat-card">{content}</div>
  );
}

function DashboardBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="admin-dashboard-bar-row">
      <div className="admin-dashboard-bar-label">
        <span>{label}</span>
        <span>{value}（{percent}%）</span>
      </div>
      <div className="admin-dashboard-bar-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
