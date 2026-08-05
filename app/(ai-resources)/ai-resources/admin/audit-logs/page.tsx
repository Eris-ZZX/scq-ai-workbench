import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import {
  AI_RESOURCE_AUDIT_ACTIONS,
  getAiResourceAuditLogs,
} from '@/modules/ai-resources/audit';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';

const actionLabels: Record<string, string> = {
  [AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_CREATE]: '创建资源',
  [AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_UPDATE]: '修改资源',
  [AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_ARCHIVE]: '归档资源',
  [AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_RESTORE]: '恢复资源',
  [AI_RESOURCE_AUDIT_ACTIONS.REVIEW_SUBMIT]: '提交审批',
  [AI_RESOURCE_AUDIT_ACTIONS.REVIEW_RESUBMIT]: '重新提交审批',
  [AI_RESOURCE_AUDIT_ACTIONS.REVIEW_APPROVE]: '审批通过',
  [AI_RESOURCE_AUDIT_ACTIONS.REVIEW_REJECT]: '审批驳回',
  [AI_RESOURCE_AUDIT_ACTIONS.REVIEW_DISCARD]: '放弃重提',
  [AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_IMPORT]: '批量导入',
  [AI_RESOURCE_AUDIT_ACTIONS.PERMISSION_UPDATE]: '权限变更',
  [AI_RESOURCE_AUDIT_ACTIONS.EXTERNAL_NOTIFICATIONS_SETTINGS_UPDATE]: '外部通知设置变更',
  [AI_RESOURCE_AUDIT_ACTIONS.EXTERNAL_NOTIFICATIONS_TEST]: '外部通知测试',
  [AI_RESOURCE_AUDIT_ACTIONS.DINGTALK_SETTINGS_UPDATE]: '通知设置变更（历史）',
  [AI_RESOURCE_AUDIT_ACTIONS.DINGTALK_TEST]: '测试通知（历史）',
};

const resultLabels: Record<string, string> = {
  SUCCESS: '成功',
  REJECTED: '拒绝',
  FAILED: '失败',
};

const targetTypeLabels: Record<string, string> = {
  RESOURCE: '资源',
  REVIEW: '审批单',
  MEMBERSHIP: '应用权限',
  DINGTALK_SETTINGS: '外部通知设置（历史）',
  IMPORT: '批量导入',
};

export default async function AiResourceAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  const params = await searchParams;
  const { page, pageSize, skip } = parsePagination(params);
  const result = await getAiResourceAuditLogs({
    actorUsername: first(params.actor),
    action: first(params.action),
    targetType: first(params.targetType),
    resourceId: first(params.resourceId),
    result: first(params.result),
    start: first(params.start),
    end: first(params.end),
    limit: pageSize,
    offset: skip,
  });
  const meta = paginationMeta(result.total, page, pageSize);

  return (
    <main className="main">
      <section className="page-head compact">
        <div>
          <p className="subtle">AI 资源库管理</p>
          <h1>详细日志审计</h1>
        </div>
        <div className="meta">
          <Link className="button" href="/ai-resources/admin">
            返回后台
          </Link>
        </div>
      </section>

      <section className="panel audit-panel">
        <form className="audit-filter" method="get">
          <input name="actor" placeholder="操作者用户名" defaultValue={first(params.actor) ?? ''} />
          <input name="resourceId" placeholder="资源 ID" defaultValue={first(params.resourceId) ?? ''} />
          <select name="action" defaultValue={first(params.action) ?? ''}>
            <option value="">全部动作</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="targetType" defaultValue={first(params.targetType) ?? ''}>
            <option value="">全部对象</option>
            {Object.entries(targetTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="result" defaultValue={first(params.result) ?? ''}>
            <option value="">全部结果</option>
            {Object.entries(resultLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input name="start" type="datetime-local" defaultValue={first(params.start) ?? ''} />
          <input name="end" type="datetime-local" defaultValue={first(params.end) ?? ''} />
          <button className="button primary" type="submit">筛选</button>
          <Link className="button" href="/ai-resources/admin/audit-logs">重置</Link>
        </form>

        <div className="audit-list">
          {result.items.map((item) => (
            <details className="audit-item" key={item.id}>
              <summary>
                <span className="audit-item-time">{formatDate(item.createdAt)}</span>
                <span className="audit-item-actor">{item.actorUsernameSnapshot}</span>
                <span className="audit-item-action">{actionLabels[item.action] ?? item.action}</span>
                <span>{targetTypeLabels[item.targetType] ?? item.targetType}</span>
                <span className={`audit-result audit-result-${String(item.result).toLowerCase()}`}>
                  {resultLabels[item.result] ?? item.result}
                </span>
              </summary>
              <div className="audit-item-detail">
                <dl>
                  <div><dt>对象 ID</dt><dd>{item.targetId ?? '-'}</dd></div>
                  <div><dt>资源 ID</dt><dd>{item.resourceId ?? '-'}</dd></div>
                  <div><dt>审批单 ID</dt><dd>{item.reviewId ?? '-'}</dd></div>
                  <div><dt>原因</dt><dd>{item.reason ?? '-'}</dd></div>
                  <div><dt>Trace ID</dt><dd>{item.traceId ?? '-'}</dd></div>
                  <div><dt>IP</dt><dd>{item.ipAddress ?? '-'}</dd></div>
                </dl>
                <div className="audit-json-grid">
                  <AuditJson title="变更前" value={item.beforeData} />
                  <AuditJson title="变更后" value={item.afterData} />
                </div>
              </div>
            </details>
          ))}
          {result.items.length === 0 ? <div className="empty">暂无符合条件的审计记录。</div> : null}
        </div>

        {result.total > 0 ? (
          <div className="pagination">
            <span className="subtle">共 {result.total} 条 · 第 {page}/{meta.totalPages} 页</span>
            <div className="meta">
              {page > 1 ? <Link className="button" href={pageHref(params, page - 1)}>上一页</Link> : null}
              {page < meta.totalPages ? <Link className="button" href={pageHref(params, page + 1)}>下一页</Link> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AuditJson({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <h3>{title}</h3>
      <pre>{formatJson(value)}</pre>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || value == null) continue;
    query.set(key, Array.isArray(value) ? value[0] ?? '' : value);
  }
  query.set('page', String(page));
  return `/ai-resources/admin/audit-logs?${query.toString()}`;
}

function formatJson(value: string | null) {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
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
