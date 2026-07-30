import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import type { AiResourceType, AiReviewStatus, AiReviewType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { hostedHtmlOpenPath, parseHostedHtml } from '@/modules/ai-resources/hosted-html';
import { fromPrismaJsonObject, parseJsonForDisplay } from '@/modules/ai-resources/json';
import {
  resourceFieldLabel,
  resourceTypeLabel,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/modules/ai-resources/labels';
import { parseList } from '@/modules/ai-resources/list-fields';
import { canActOnReviewRequest, canAdmin, canResubmitReview, canReview } from '@/modules/ai-resources/policy';
import { DownloadAttachment } from '@/modules/ai-resources/ui/download-attachment';
import { RejectedReworkActions } from '@/modules/ai-resources/ui/rejected-rework-actions';
import { ReviewActions } from '@/modules/ai-resources/ui/review-actions';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAiResourceUser();
  const { id } = await params;

  const request = await prisma.aiResourceReviewRequest.findUnique({
    where: { id },
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
          attachments: true,
          extension: true,
        },
      },
    },
  });

  if (!request) notFound();

  const isRequester = request.requesterId === actor.userId;
  const isAssignee = request.reviewerId === actor.userId;
  const isAdmin = canAdmin(actor);
  if (!isRequester && !canReview(actor) && !isAssignee) {
    notFound();
  }
  if (
    request.status === 'PENDING' &&
    request.reviewerId &&
    !isRequester &&
    !isAssignee &&
    !isAdmin
  ) {
    notFound();
  }

  const proposed = fromPrismaJsonObject(request.proposedData) as Record<string, unknown>;
  const changedFields = parseList(request.changedFields);
  const canAct = canActOnReviewRequest(actor, request);
  const canRework = canResubmitReview(actor, request);
  const title = String(proposed.name ?? request.resource?.name ?? '未命名资源');
  const type = (proposed.type as AiResourceType | undefined) ?? (request.resource?.type as AiResourceType | undefined);
  const tags = parseList(proposed.tags ?? request.resource?.tags);
  const attachments = parseAttachments(proposed.attachments ?? request.resource?.attachments);
  const resourceUrls = parseResourceUrls(
    typeof proposed.resourceUrl === 'string'
      ? proposed.resourceUrl
      : request.resource?.resourceUrl,
  );
  const hostedHtml = parseHostedHtml(proposed.extension ?? request.resource?.extension);

  return (
    <main className="main">
      <section className="detail-head">
        <div>
          <Link className="subtle review-back-link" href="/ai-resources/review">
            <ArrowLeft size={14} />
            返回审批列表
          </Link>
          <p className="eyebrow">
            {reviewTypeLabel[request.type as AiReviewType]} ·{' '}
            {type ? resourceTypeLabel[type] ?? type : '资源'}
          </p>
          <h1>{title}</h1>
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
      </section>

      <div className="detail-layout review-detail-layout">
        <article className="detail-main">
          <section className="panel detail-panel">
            <h2>资源信息</h2>
            <div className="meta">
              {type ? (
                <span className="badge primary">{resourceTypeLabel[type] ?? type}</span>
              ) : null}
              {tags.map((tag) => (
                <span className="badge" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="detail-fields">
              <div>
                <span className="subtle">负责人</span>
                <strong>{String(proposed.ownerName ?? request.resource?.ownerName ?? '-')}</strong>
              </div>
              <div>
                <span className="subtle">提交人</span>
                <strong>{request.requester.username}</strong>
              </div>
            </div>
          </section>

          <section className="panel detail-panel">
            <h2>面向用户/使用说明</h2>
            <p className="detail-text">{String(proposed.summary ?? request.resource?.summary ?? '（空）')}</p>
          </section>

          <section className="panel detail-panel">
            <h2>实现方法简述</h2>
            <p className="detail-text">{String(proposed.content ?? request.resource?.content ?? '（空）')}</p>
          </section>

          <section className="panel detail-panel">
            <h2>存储路径/链接</h2>
            {resourceUrls.length ? (
              <div className="path-list">
                {resourceUrls.map((resourceUrl, index) =>
                  isOpenableLink(resourceUrl.url) ? (
                    <a
                      className="resource-link-button"
                      href={resourceUrl.url}
                      target="_blank"
                      rel="noreferrer"
                      title={resourceUrl.url}
                      key={`${index}-${resourceUrl.label}-${resourceUrl.url}`}
                    >
                      <FolderOpen size={14} />
                      <span>{resourceUrl.label}</span>
                    </a>
                  ) : (
                    <span
                      className="resource-link-button"
                      title={resourceUrl.url}
                      key={`${index}-${resourceUrl.label}-${resourceUrl.url}`}
                    >
                      <FolderOpen size={14} />
                      <span>{resourceUrl.label}</span>
                    </span>
                  ),
                )}
              </div>
            ) : (
              <p className="subtle">暂无存储路径/链接。</p>
            )}
          </section>

          <section className="panel detail-panel">
            <h2>附件</h2>
            <div className="attachment-list">
              {attachments.length ? (
                attachments.map((attachment) => (
                  <DownloadAttachment key={attachment.url} name={attachment.name} url={attachment.url} />
                ))
              ) : (
                <p className="subtle">暂无附件。</p>
              )}
            </div>
            {hostedHtml ? (
              <p className="subtle" style={{ margin: 0 }}>
                托管 HTML：{hostedHtml.originalName}
                {request.resourceId ? (
                  <>
                    {' · '}
                    <a
                      href={hostedHtmlOpenPath(request.resourceId)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      打开页面
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>

          {request.type === 'UPDATE' && request.resource ? (
            <section className="panel detail-panel">
              <h2>变更对比</h2>
              <div className="review-diff-grid">
                {(changedFields.length ? changedFields : ['summary', 'content']).map((field) => (
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
            </section>
          ) : null}

          {request.type === 'ARCHIVE' ? (
            <section className="panel detail-panel">
              <h2>删除说明</h2>
              <p className="detail-text">
                通过后资源将归档下线，不再出现在资源库中。管理员仍可在后台恢复。
              </p>
            </section>
          ) : null}
        </article>

        <aside className="detail-aside review-detail-aside">
          <section className="panel detail-panel review-action-panel">
            <h2>审批</h2>
            <div className="review-aside-meta">
              <div>
                <span className="subtle">类型</span>
                <strong>{reviewTypeLabel[request.type as AiReviewType]}</strong>
              </div>
              <div>
                <span className="subtle">状态</span>
                <strong>{reviewStatusLabel[request.status as AiReviewStatus]}</strong>
              </div>
              <div>
                <span className="subtle">提交人</span>
                <strong>{request.requester.username}</strong>
              </div>
              {request.reviewer ? (
                <div>
                  <span className="subtle">
                    {request.status === 'PENDING' ? '指定审批人' : '审批人'}
                  </span>
                  <strong>{request.reviewer.username}</strong>
                </div>
              ) : null}
              {request.updateSummary ? (
                <div>
                  <span className="subtle">变更说明</span>
                  <p className="detail-text">{request.updateSummary}</p>
                </div>
              ) : null}
              {request.rejectReason ? (
                <div>
                  <span className="subtle">驳回原因</span>
                  <p className="reject-reason">{request.rejectReason}</p>
                </div>
              ) : null}
            </div>

            {canAct ? (
              <ReviewActions reviewId={request.id} redirectTo="/ai-resources/review?tab=pending" stacked />
            ) : canRework ? (
              <RejectedReworkActions
                reviewId={request.id}
                reviewType={request.type}
                initialReviewerId={request.reviewerId}
              />
            ) : request.status === 'PENDING' ? (
              <p className="subtle">当前账号不可对此单执行审批。</p>
            ) : (
              <p className="subtle">该申请已处理。</p>
            )}

            {request.resourceId ? (
              <Link className="button" href={`/ai-resources/${request.resourceId}`}>
                查看已发布资源
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
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

type ResourceAttachment = {
  name: string;
  url: string;
  size: number;
  type: string;
};

function parseAttachments(value: unknown): ResourceAttachment[] {
  const parsed = parseJsonForDisplay(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((item): item is ResourceAttachment => {
    return (
      !!item &&
      typeof item === 'object' &&
      typeof (item as ResourceAttachment).name === 'string' &&
      typeof (item as ResourceAttachment).url === 'string' &&
      typeof (item as ResourceAttachment).size === 'number' &&
      typeof (item as ResourceAttachment).type === 'string'
    );
  });
}

function isOpenableLink(value: string) {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function parseResourceUrls(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const result: NamedUrl[] = [];
      for (const item of parsed) {
        if (typeof item === 'string') {
          result.push({ url: item, label: item });
        } else if (item && typeof item === 'object' && 'url' in item) {
          result.push({
            url: String(item.url),
            label: String((item as Record<string, unknown>).label ?? item.url),
          });
        }
      }
      return result.filter((r) => !!r.url.trim());
    }
  } catch {
    // plain string
  }
  return [{ url: value, label: value }];
}

type NamedUrl = { url: string; label: string };
