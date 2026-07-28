import Link from 'next/link';
import { Suspense } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { isAiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { parseList } from '@/modules/ai-resources/list-fields';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';
import { ResourceCard } from '@/modules/ai-resources/ui/resource-card';
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

  const [total, resources, allPublished, favorites, likes] = await Promise.all([
    prisma.aiResource.count({ where }),
    prisma.aiResource.findMany({
      where,
      include: {
        createdBy: { select: { username: true } },
        _count: { select: { favorites: true, likes: true } },
      },
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
    prisma.aiResourceLike.findMany({
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
  const likedIds = new Set(likes.map((item) => item.resourceId));
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
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  favorited={favoriteIds.has(resource.id)}
                  liked={likedIds.has(resource.id)}
                  likeCount={resource._count.likes}
                  favoriteCount={resource._count.favorites}
                />
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
