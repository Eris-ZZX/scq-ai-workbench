import Link from 'next/link';
import { db } from '@/lib/database';
import type { AiResourceType, AiReviewStatus, AiReviewType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import {
  resourceTypeLabel,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/modules/ai-resources/labels';
import { fromJsonObject } from '@/modules/ai-resources/json';
import { canReview, inboxReviewWhere } from '@/modules/ai-resources/policy';
import type { AiResourceActor } from '@/modules/ai-resources/guards';
import type { QueryArgs } from '@/lib/database';

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

  const requests = await db.aiResourceReviewRequest.findMany({
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
    db.aiResourceReviewRequest.count({
      where: inboxReviewWhere(actor),
    }),
    db.aiResourceReviewRequest.count({ where: { requesterId: actor.userId } }),
    db.aiResourceReviewRequest.count({
      where: doneReviewWhere(actor, isReviewer),
    }),
  ]);

  return (
    <main className="main">
      <nav className="review-tabs" aria-label="审批筛选">
        <Link
          className={tab === 'pending' ? 'review-tab active' : 'review-tab'}
          href="/ai-resources/review?tab=pending"
        >
          待我处理
          <strong>{pendingCount}</strong>
        </Link>
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
            const proposed = fromJsonObject(request.proposedData) as Record<string, unknown>;
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
                        : request.status === 'DISCARDED'
                          ? 'badge'
                          : 'badge'
                  }
                >
                  {reviewStatusLabel[request.status as AiReviewStatus] ?? request.status}
                </span>
              </Link>
            );
          })
        ) : (
          <div className="empty">暂无待处理记录。</div>
        )}
      </section>
    </main>
  );
}

function resolveTab(tab: string | undefined, isReviewer: boolean): TabKey {
  if (tab === 'pending' || tab === 'mine' || tab === 'done') return tab;
  return isReviewer ? 'pending' : 'pending';
}

function buildWhere(
  actor: AiResourceActor,
  isReviewer: boolean,
  tab: TabKey,
): QueryArgs {
  if (tab === 'pending') {
    return inboxReviewWhere(actor);
  }
  if (tab === 'mine') {
    return { requesterId: actor.userId };
  }
  return doneReviewWhere(actor, isReviewer);
}

function doneReviewWhere(
  actor: AiResourceActor,
  isReviewer: boolean,
): QueryArgs {
  if (isReviewer) {
    return {
      OR: [
        {
          status: 'APPROVED',
          OR: [{ reviewerId: actor.userId }, { requesterId: actor.userId }],
        },
        {
          status: 'REJECTED',
          reviewerId: actor.userId,
          requesterId: { not: actor.userId },
        },
        {
          status: 'DISCARDED',
          requesterId: actor.userId,
        },
      ],
    };
  }
  return {
    requesterId: actor.userId,
    status: { in: ['APPROVED', 'DISCARDED'] },
  };
}
