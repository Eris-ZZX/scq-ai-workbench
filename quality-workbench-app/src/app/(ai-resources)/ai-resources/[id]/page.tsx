import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Edit3, ExternalLink, FolderOpen, UserRound } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { hostedHtmlOpenPath, parseHostedHtml } from '@/modules/ai-resources/hosted-html';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseJsonForDisplay } from '@/modules/ai-resources/json';
import { parseList } from '@/modules/ai-resources/list-fields';
import { canEditResource, canViewResource, visibleResourceWhere } from '@/modules/ai-resources/policy';
import { DownloadAttachment } from '@/modules/ai-resources/ui/download-attachment';
import {
  ResourceEngagementProvider,
  ResourceEngagementToggles,
} from '@/modules/ai-resources/ui/resource-engagement';
import { UpdateHistoryDialog } from '@/modules/ai-resources/ui/update-history-dialog';
import { ViewTracker } from '@/modules/ai-resources/ui/view-tracker';

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAiResourceUser();
  const { id } = await params;
  const resource = await prisma.aiResource.findFirst({
    where: {
      id,
      AND: [visibleResourceWhere(actor)],
    },
    include: {
      createdBy: { select: { username: true } },
      _count: { select: { favorites: true, likes: true } },
      updateLogs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
          actor: { select: { username: true } },
          reviewer: { select: { username: true } },
        },
      },
    },
  });

  if (!resource || !canViewResource(actor, resource)) notFound();

  const [favorite, like] = await Promise.all([
    prisma.aiResourceFavorite.findUnique({
      where: { userId_resourceId: { userId: actor.userId, resourceId: id } },
    }),
    prisma.aiResourceLike.findUnique({
      where: { userId_resourceId: { userId: actor.userId, resourceId: id } },
    }),
  ]);

  const attachments = parseAttachments(resource.attachments);
  const resourceUrls = parseResourceUrls(resource.resourceUrl);
  const hostedHtml = parseHostedHtml(resource.extension);
  const updateHistory = resource.updateLogs.map((log) => ({
    id: log.id,
    time: formatDate(log.createdAt),
    reason: log.updateSummary,
  }));

  return (
    <main className="main">
      <ViewTracker resourceId={resource.id} />
      <ResourceEngagementProvider
        resourceId={resource.id}
        initialLiked={!!like}
        initialFavorited={!!favorite}
        initialLikeCount={resource._count.likes}
        initialFavoriteCount={resource._count.favorites}
        viewCount={resource.viewCount}
        currentVersion={resource.currentVersion}
      >
      <section className="detail-head">
        <div>
          <p className="eyebrow">{resourceTypeLabel[resource.type as AiResourceType] ?? resource.type}</p>
          <h1>{resource.name}</h1>
        </div>
        <div className="meta">
          <ResourceEngagementToggles />
          {hostedHtml ? (
            <a
              className="button primary"
              href={hostedHtmlOpenPath(resource.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              打开页面
            </a>
          ) : null}
          {canEditResource(actor, resource) ? (
            <Link className={hostedHtml ? 'button' : 'button primary'} href={`/ai-resources/${resource.id}/edit`}>
              <Edit3 size={16} />
              提交修改
            </Link>
          ) : null}
        </div>
      </section>

      <div className="detail-layout">
        <article className="detail-main">
          <section className="panel detail-panel">
            <h2>资源信息</h2>
            <div className="meta">
              <span className="badge primary">
                {resourceTypeLabel[resource.type as AiResourceType] ?? resource.type}
              </span>
              <span className="badge">v{resource.currentVersion}</span>
              {parseList(resource.tags).map((tag) => (
                <span className="badge" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="detail-fields">
              <div>
                <span className="subtle">负责人</span>
                <strong>
                  <UserRound size={15} />
                  {resource.ownerName}
                </strong>
              </div>
              <div>
                <span className="subtle">创建人</span>
                <strong>{resource.createdBy.username}</strong>
              </div>
              <div>
                <span className="subtle">当前版本</span>
                <strong>v{resource.currentVersion}</strong>
              </div>
              <div>
                <span className="subtle">更新时间</span>
                <strong>
                  <CalendarDays size={15} />
                  {formatDate(resource.updatedAt)}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel detail-panel">
            <h2>面向用户/使用说明</h2>
            <p className="detail-text">{resource.summary}</p>
          </section>

          <section className="panel detail-panel">
            <h2>实现方法简述</h2>
            <p className="detail-text">{resource.content}</p>
          </section>
        </article>

        <aside className="detail-aside">
          {hostedHtml ? (
            <section className="panel detail-panel">
              <h2>托管 HTML</h2>
              <p className="subtle" style={{ margin: 0 }}>
                {hostedHtml.originalName}
              </p>
              <a
                className="button primary"
                href={hostedHtmlOpenPath(resource.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} />
                打开页面
              </a>
            </section>
          ) : null}

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
          </section>

          <section className="panel detail-panel">
            <h2>更新记录</h2>
            <UpdateHistoryDialog resourceId={resource.id} initialItems={updateHistory} />
          </section>
        </aside>
      </div>
      </ResourceEngagementProvider>
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
      typeof item.name === 'string' &&
      typeof item.url === 'string' &&
      typeof item.size === 'number' &&
      typeof item.type === 'string'
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
