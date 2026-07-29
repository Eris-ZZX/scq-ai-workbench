import Link from 'next/link';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { parseJsonForDisplay } from '@/modules/ai-resources/json';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseList } from '@/modules/ai-resources/list-fields';
import { parseResourceLinks } from '@/modules/ai-resources/resource-links';
import {
  ResourceEngagementProvider,
  ResourceEngagementStats,
  ResourceEngagementToggles,
} from '@/modules/ai-resources/ui/resource-engagement';
import { CardLinksRow } from '@/modules/ai-resources/ui/card-links-row';

type ResourceAttachment = {
  name: string;
  url: string;
};

type ResourceCardData = {
  id: string;
  name: string;
  type: string;
  summary: string;
  tags: string;
  ownerName: string;
  resourceUrl?: string | null;
  attachments?: unknown;
  currentVersion: number;
  viewCount: number;
};

export function ResourceCard({
  resource,
  favorited,
  liked = false,
  likeCount = 0,
  favoriteCount = 0,
}: {
  resource: ResourceCardData;
  favorited: boolean;
  liked?: boolean;
  likeCount?: number;
  favoriteCount?: number;
}) {
  const summary = resource.summary.trim();
  const tags = parseList(resource.tags).slice(0, 5);
  const links = parseResourceLinks(resource.resourceUrl);
  const attachments = parseAttachments(resource.attachments);
  const attachmentText = attachments.map((item) => item.name).join('、');

  return (
    <ResourceEngagementProvider
      resourceId={resource.id}
      initialLiked={liked}
      initialFavorited={favorited}
      initialLikeCount={likeCount}
      initialFavoriteCount={favoriteCount}
      viewCount={resource.viewCount}
      currentVersion={resource.currentVersion}
    >
      <Link className="resource-card resource-card-link" href={`/ai-resources/${resource.id}`}>
        <div className="resource-card-body">
          <section className="resource-card-col resource-card-col-main">
            <div className="resource-card-title-row">
              <div className="resource-card-heading">
                <span className="badge primary">
                  {resourceTypeLabel[resource.type as AiResourceType] ?? resource.type}
                </span>
                <h2>{resource.name}</h2>
              </div>
              <ResourceEngagementToggles />
            </div>
            <div className="resource-card-main-row">
              <div className="resource-card-facts">
                <div className="resource-card-fact">
                  <span className="resource-card-fact-label">负责人</span>
                  <span className="resource-card-plain">{resource.ownerName || '未填写'}</span>
                </div>
                <div className="resource-card-fact">
                  <span className="resource-card-fact-label">适用小组</span>
                  <div className="resource-card-fact-value">
                    {tags.length ? (
                      tags.map((tag) => (
                        <span className="badge" key={tag}>
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="resource-card-muted">未设置</span>
                    )}
                  </div>
                </div>
              </div>
              <ResourceEngagementStats />
            </div>
          </section>

          <section className="resource-card-col resource-card-col-assets">
            <div className="resource-card-block">
              <span className="resource-card-label">链接</span>
              {links.length ? <CardLinksRow links={links} /> : <span className="resource-card-muted">无链接</span>}
            </div>
            <div className="resource-card-block">
              <span className="resource-card-label">附件</span>
              {attachments.length ? (
                <span className="resource-card-clip" title={attachmentText}>
                  {attachments.length} 个 · {attachmentText}
                </span>
              ) : (
                <span className="resource-card-muted">无附件</span>
              )}
            </div>
          </section>

          <section className="resource-card-col resource-card-col-summary">
            <span className="resource-card-label">使用说明</span>
            <p className={summary ? undefined : 'is-empty'}>{summary || '暂无使用说明'}</p>
          </section>
        </div>
      </Link>
    </ResourceEngagementProvider>
  );
}

function parseAttachments(value: unknown): ResourceAttachment[] {
  const parsed = parseJsonForDisplay(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name.trim() : '';
      const url = typeof (item as { url?: unknown }).url === 'string' ? (item as { url: string }).url.trim() : '';
      if (!name || !url) return null;
      return { name, url };
    })
    .filter((item): item is ResourceAttachment => !!item);
}
