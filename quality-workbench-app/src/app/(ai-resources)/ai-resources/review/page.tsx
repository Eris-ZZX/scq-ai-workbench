import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { AiResourceType, AiReviewStatus } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import {
  resourceFieldLabel,
  resourceTypeLabel,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/modules/ai-resources/labels';
import { fromPrismaJsonObject } from '@/modules/ai-resources/json';
import { parseList } from '@/modules/ai-resources/list-fields';
import { canReview } from '@/modules/ai-resources/policy';
import { ReviewActions } from '@/modules/ai-resources/ui/review-actions';

type TabKey = 'pending' | 'mine' | 'done';

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requireAiResourceUser();
  const isReviewer = canReview(actor);
  const params = await searchParams;
  const tab = resolveTab(params.tab, isReviewer);

  const requests = await prisma.aiResourceReviewRequest.findMany({
    where: buildWhere(actor.userId, isReviewer, tab),
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      requester: { select: { username: true } },
      reviewer: { select: { username: true } },
      resource: {
        select: {
          id: true,
          name: true,
          summary: true,
          type: true,
          tags: true,
          ownerName: true,
          content: true,
          resourceUrl: true,
        },
      },
    },
  });

  const [pendingCount, mineCount, doneCount] = await Promise.all([
    isReviewer
      ? prisma.aiResourceReviewRequest.count({
          where: { status: 'PENDING', requesterId: { not: actor.userId } },
        })
      : Promise.resolve(0),
    prisma.aiResourceReviewRequest.count({ where: { requesterId: actor.userId } }),
    isReviewer
      ? prisma.aiResourceReviewRequest.count({
          where: {
            status: { in: ['APPROVED', 'REJECTED'] },
            OR: [{ reviewerId: actor.userId }, { requesterId: actor.userId }],
          },
        })
      : prisma.aiResourceReviewRequest.count({
          where: {
            requesterId: actor.userId,
            status: { in: ['APPROVED', 'REJECTED'] },
          },
        }),
  ]);

  return (
    <main className="main">
      <nav className="review-tabs" aria-label="审批筛选">
        {isReviewer ? (
          <Link
            className={tab === 'pending' ? 'review-tab active' : 'review-tab'}
            href="/ai-resources/review?tab=pending"
          >
            待我审批
            <strong>{pendingCount}</strong>
          </Link>
        ) : null}
        <Link className={tab === 'mine' ? 'review-tab active' : 'review-tab'} href="/ai-resources/review?tab=mine">
          我的提交
          <strong>{mineCount}</strong>
        </Link>
        <Link className={tab === 'done' ? 'review-tab active' : 'review-tab'} href="/ai-resources/review?tab=done">
          已处理
          <strong>{doneCount}</strong>
        </Link>
      </nav>

      <section className="resource-list">
        {requests.length ? (
          requests.map((request) => {
            const proposed = fromPrismaJsonObject(request.proposedData) as Record<string, unknown>;
            const changedFields = parseList(request.changedFields);
            const canAct =
              isReviewer && request.status === 'PENDING' && request.requesterId !== actor.userId;

            return (
              <article className="resource-card" key={request.id}>
                <header>
                  <div>
                    <h2>{String(proposed.name ?? request.resource?.name ?? '未命名资源')}</h2>
                    <p className="subtle">{String(proposed.summary ?? request.resource?.summary ?? '')}</p>
                  </div>
                  <span
                    className={
                      request.status === 'PENDING'
                        ? 'badge warning'
                        : request.status === 'REJECTED'
                          ? 'badge danger'
                          : 'badge'
                    }
                  >
                    {reviewStatusLabel[request.status as AiReviewStatus]}
                  </span>
                </header>
                <div className="meta">
                  <span className="badge primary">{reviewTypeLabel[request.type as 'CREATE' | 'UPDATE']}</span>
                  <span className="badge">提交人：{request.requester.username}</span>
                  {request.reviewer ? <span className="badge">审批人：{request.reviewer.username}</span> : null}
                  <span className="badge">
                    变更字段：
                    {changedFields.map((field) => resourceFieldLabel[field] ?? field).join('、') || '无'}
                  </span>
                </div>
                <p>{request.updateSummary}</p>
                {request.rejectReason ? <p className="reject-reason">驳回原因：{request.rejectReason}</p> : null}

                {request.type === 'UPDATE' && request.resource ? (
                  <div className="review-diff">
                    <h3>变更对比</h3>
                    <div className="review-diff-grid">
                      {(changedFields.length ? changedFields : ['summary', 'content']).slice(0, 8).map((field) => (
                        <div className="review-diff-row" key={field}>
                          <strong>{resourceFieldLabel[field] ?? field}</strong>
                          <div>
                            <span className="subtle">当前</span>
                            <p>{formatFieldValue(field, (request.resource as Record<string, unknown>)?.[field])}</p>
                          </div>
                          <div>
                            <span className="subtle">申请后</span>
                            <p>{formatFieldValue(field, proposed[field])}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {request.type === 'CREATE' ? (
                  <div className="review-diff">
                    <h3>申请内容摘要</h3>
                    <div className="meta">
                      <span className="badge">
                        类型：
                        {resourceTypeLabel[(proposed.type as AiResourceType) ?? 'OTHER'] ??
                          String(proposed.type ?? '-')}
                      </span>
                      <span className="badge">负责人：{String(proposed.ownerName ?? '-')}</span>
                    </div>
                  </div>
                ) : null}

                <div className="meta">
                  {request.resourceId ? (
                    <Link className="button" href={`/ai-resources/${request.resourceId}`}>
                      查看资源
                    </Link>
                  ) : null}
                  {canAct ? <ReviewActions reviewId={request.id} /> : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty">暂无审批记录。</div>
        )}
      </section>
    </main>
  );
}

function resolveTab(tab: string | undefined, isReviewer: boolean): TabKey {
  if (tab === 'pending' || tab === 'mine' || tab === 'done') return tab;
  return isReviewer ? 'pending' : 'mine';
}

function buildWhere(userId: string, isReviewer: boolean, tab: TabKey) {
  if (tab === 'pending') {
    return {
      status: 'PENDING',
      ...(isReviewer ? { requesterId: { not: userId } } : { requesterId: userId }),
    };
  }
  if (tab === 'mine') {
    return { requesterId: userId };
  }
  return {
    status: { in: ['APPROVED', 'REJECTED'] },
    ...(isReviewer ? { OR: [{ reviewerId: userId }, { requesterId: userId }] } : { requesterId: userId }),
  };
}

function formatFieldValue(field: string, value: unknown) {
  if (value == null || value === '') return '（空）';
  if (field === 'type' && typeof value === 'string' && value in resourceTypeLabel) {
    return resourceTypeLabel[value as AiResourceType];
  }
  if (field === 'tags') {
    if (Array.isArray(value)) return value.join('、') || '（空）';
    if (typeof value === 'string') return parseList(value).join('、') || '（空）';
  }
  if (Array.isArray(value)) return value.join('、') || '（空）';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
