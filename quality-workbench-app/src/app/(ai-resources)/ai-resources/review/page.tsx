import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { AiResourceType, AiReviewStatus, AiReviewType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import {
  resourceTypeLabel,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/modules/ai-resources/labels';
import { fromPrismaJsonObject } from '@/modules/ai-resources/json';
import { canReview, pendingReviewWhere } from '@/modules/ai-resources/policy';

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
    where: buildWhere(actor, isReviewer, tab),
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
        },
      },
    },
  });

  const [pendingCount, mineCount, doneCount] = await Promise.all([
    isReviewer
      ? prisma.aiResourceReviewRequest.count({
          where: pendingReviewWhere(actor),
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

      <section className="review-list">
        {requests.length ? (
          requests.map((request) => {
            const proposed = fromPrismaJsonObject(request.proposedData) as Record<string, unknown>;
            const title = String(proposed.name ?? request.resource?.name ?? '未命名资源');
            const summary = String(proposed.summary ?? request.resource?.summary ?? '');
            const type = (proposed.type as AiResourceType | undefined) ?? undefined;
            const reviewerLabel = request.status === 'PENDING' ? '指定审批人' : '审批人';

            return (
              <Link className="review-list-card" href={`/ai-resources/review/${request.id}`} key={request.id}>
                <div className="review-list-card-main">
                  <h2>{title}</h2>
                  {summary ? <p className="subtle">{summary}</p> : null}
                  <div className="meta">
                    <span className="badge primary">{reviewTypeLabel[request.type as AiReviewType]}</span>
                    {type ? (
                      <span className="badge">{resourceTypeLabel[type] ?? type}</span>
                    ) : null}
                    <span className="badge">提交人：{request.requester.username}</span>
                    {request.reviewer ? (
                      <span className="badge">
                        {reviewerLabel}：{request.reviewer.username}
                      </span>
                    ) : null}
                  </div>
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
              </Link>
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

function buildWhere(
  actor: Parameters<typeof pendingReviewWhere>[0],
  isReviewer: boolean,
  tab: TabKey,
) {
  if (tab === 'pending') {
    return pendingReviewWhere(actor);
  }
  if (tab === 'mine') {
    return { requesterId: actor.userId };
  }
  return {
    status: { in: ['APPROVED', 'REJECTED'] },
    ...(isReviewer ? { OR: [{ reviewerId: actor.userId }, { requesterId: actor.userId }] } : { requesterId: actor.userId }),
  };
}
