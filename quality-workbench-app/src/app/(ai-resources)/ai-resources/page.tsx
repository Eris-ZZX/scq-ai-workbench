import Link from 'next/link';
import { Suspense } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { Clock, Eye, Tags } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { isAiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseList } from '@/modules/ai-resources/list-fields';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';
import { FavoriteToggle } from '@/modules/ai-resources/ui/favorite-toggle';
import { QuickLinks } from '@/modules/ai-resources/ui/quick-links';
import { ResourceSearch } from '@/modules/ai-resources/ui/resource-search';
import { ResourceSidebar } from '@/modules/ai-resources/ui/resource-sidebar';

const PAGE_SIZE = 20;

export default async function AiResourcesHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; tag?: string; page?: string }>;
}) {
  const actor = await requireAiResourceUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = buildWhere(actor, params);

  const [total, resources, allPublished, favorites] = await Promise.all([
    prisma.aiResource.count({ where }),
    prisma.aiResource.findMany({
      where,
      include: { createdBy: { select: { username: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.aiResource.findMany({
      where: { status: 'PUBLISHED' },
      select: { type: true, tags: true },
    }),
    prisma.aiResourceFavorite.findMany({
      where: { userId: actor.userId },
      select: { resourceId: true },
    }),
  ]);

  const typeCounts = allPublished.reduce<Partial<Record<AiResourceType, number>>>((counts, resource) => {
    const type = resource.type as AiResourceType;
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});
  const quickTags = Array.from(new Set(allPublished.flatMap((r) => parseList(r.tags)))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
  const favoriteIds = new Set(favorites.map((f) => f.resourceId));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="main home">
      <div className="catalog-layout">
        <ResourceSidebar currentType={params.type} counts={typeCounts} q={params.q} tag={params.tag} />
        <div className="catalog-content">
          <Suspense fallback={<div className="toolbar" />}>
            <ResourceSearch tags={quickTags} />
          </Suspense>

          <section className="resource-list">
            {resources.length ? (
              resources.map((resource) => (
                <Link
                  className="resource-card resource-card-link"
                  href={`/ai-resources/${resource.id}`}
                  key={resource.id}
                >
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <h2>
                        <span className="badge primary">
                          {resourceTypeLabel[resource.type as AiResourceType] ?? resource.type}
                        </span>
                        {resource.name}
                        <QuickLinks resourceUrl={resource.resourceUrl} />
                      </h2>
                      <p className="subtle">{resource.summary}</p>
                    </div>
                    <FavoriteToggle resourceId={resource.id} initialFavorited={favoriteIds.has(resource.id)} />
                  </header>
                  <div className="meta">
                    <span className="badge">
                      <Clock size={13} />
                      v{resource.currentVersion}
                    </span>
                    <span className="badge">
                      <Eye size={13} />
                      {resource.viewCount}
                    </span>
                    <span className="badge">负责人：{resource.ownerName}</span>
                    {parseList(resource.tags)
                      .slice(0, 5)
                      .map((tag) => (
                        <span className="badge" key={tag}>
                          <Tags size={13} />
                          {tag}
                        </span>
                      ))}
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty">没有找到匹配的资源。</div>
            )}
          </section>

          {total > 0 ? (
            <div className="pagination">
              <span className="subtle">
                共 {total} 条 · 第 {page}/{totalPages} 页
              </span>
              <div className="meta">
                {page > 1 ? (
                  <Link className="button" href={pageHref(params, page - 1)}>
                    上一页
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link className="button" href={pageHref(params, page + 1)}>
                    下一页
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function pageHref(params: { q?: string; type?: string; tag?: string }, page: number) {
  const next = new URLSearchParams();
  if (params.type) next.set('type', params.type);
  if (params.q?.trim()) next.set('q', params.q.trim());
  if (params.tag?.trim()) next.set('tag', params.tag.trim());
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `/ai-resources?${query}` : '/ai-resources';
}

function buildWhere(
  actor: Awaited<ReturnType<typeof requireAiResourceUser>>,
  params: { q?: string; type?: string; tag?: string },
) {
  const filters: Prisma.AiResourceWhereInput[] = [visibleResourceWhere(actor)];
  const q = params.q?.trim();
  if (params.type && isAiResourceType(params.type)) {
    filters.push({ type: params.type });
  }
  if (params.tag?.trim()) {
    filters.push({ tags: { contains: params.tag.trim() } });
  }
  if (q) {
    filters.push({
      OR: [
        { name: { contains: q } },
        { summary: { contains: q } },
        { content: { contains: q } },
        { extractedText: { contains: q } },
        { ownerName: { contains: q } },
        { tags: { contains: q } },
      ],
    });
  }

  filters.push({ status: 'PUBLISHED' });
  return { AND: filters };
}
