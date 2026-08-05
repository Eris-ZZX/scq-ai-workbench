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
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}) {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  const params = await searchParams;
  const dashboard = await getAiResourceDashboard({
    days: params.days === 'all' ? 'all' : Number(params.days ?? 30),
    start: params.start,
    end: params.end,
  });
  const hasCustomRange = Boolean(params.start || params.end);
  const rangeDescription = dashboard.range.all
    ? '全部时间'
    : `${dashboard.range.start ?? '最近'} 至 ${dashboard.range.end ?? '今天'}`;
  const maxTrendValue = Math.max(
    1,
    ...dashboard.trend.map((item) => item.created + item.updated + item.approved),
  );

  return (
    <main className="main">
      <section className="page-head compact">
        <div className="dashboard-toolbar">
          <div className="dashboard-quick-actions" aria-label="快捷时间范围">
            {[
              { value: '7', label: '7天' },
              { value: '30', label: '30天' },
              { value: 'all', label: '全部' },
            ].map((shortcut) => (
              <Link
                key={shortcut.value}
                className={`button${!hasCustomRange && (shortcut.value === 'all' ? dashboard.range.all : dashboard.days === Number(shortcut.value)) ? ' primary' : ''}`}
                href={`/ai-resources/admin/dashboard?days=${shortcut.value}`}
              >
                {shortcut.label}
              </Link>
            ))}
          </div>
          <form className="dashboard-range-picker" method="get">
            <label>
              开始日期
              <input name="start" type="date" defaultValue={params.start ?? ''} />
            </label>
            <span className="dashboard-range-separator">至</span>
            <label>
              结束日期
              <input name="end" type="date" defaultValue={params.end ?? ''} />
            </label>
            <button className="button primary" type="submit">查询</button>
          </form>
          <span className="dashboard-range-description">统计区间：{rangeDescription}</span>
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

      <div className="admin-dashboard-grid admin-dashboard-grid-three">
        <DistributionTable
          title="用户数量"
          subtitle="平台账号与 AI 资源库成员"
          rows={dashboard.userSummary}
        />
        <DistributionTable
          title="用户所在小组"
          subtitle="按钉钉组织主部门统计"
          rows={dashboard.groupDistribution}
          showPercent
        />
        <DistributionTable
          title="岗位分布"
          subtitle="按活跃用户当前岗位统计"
          rows={dashboard.positionDistribution}
          showPercent
        />
      </div>

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
          <div className="dashboard-trend" aria-label={`${rangeDescription}资源趋势`}>
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
            {dashboard.trend.length === 0 ? <div className="empty">所选时间段暂无记录。</div> : null}
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

function DistributionTable({
  title,
  subtitle,
  rows,
  showPercent = false,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; count: number }>;
  showPercent?: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="panel dashboard-distribution-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p className="subtle">{subtitle}</p>
        </div>
      </div>
      <div className="dashboard-distribution-table-wrap">
        <table className="dashboard-distribution-table">
          <thead>
            <tr>
              <th scope="col">{showPercent ? '小组 / 岗位' : '统计项'}</th>
              <th scope="col">人数</th>
              {showPercent ? <th scope="col">占比</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.count.toLocaleString('zh-CN')}</td>
                {showPercent ? (
                  <td>{total > 0 ? `${Math.round((row.count / total) * 100)}%` : '0%'}</td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showPercent ? 3 : 2} className="empty">暂无数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
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
