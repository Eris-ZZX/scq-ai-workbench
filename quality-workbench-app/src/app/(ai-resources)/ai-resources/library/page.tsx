import Link from 'next/link';
import { Suspense } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { isAiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { getPublishedCatalogFacets } from '@/modules/ai-resources/catalog-facets';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';
import { ResourceCard } from '@/modules/ai-resources/ui/resource-card';
import { ResourceSearch } from '@/modules/ai-resources/ui/resource-search';
import { ResourceSidebar } from '@/modules/ai-resources/ui/resource-sidebar';

const PAGE_SIZE = 20;

const SORT_OPTIONS = ['views', 'likes', 'favorites'] as const;
type LibrarySort = (typeof SORT_OPTIONS)[number];

type LibraryParams = {
  q?: string;
  type?: string;
  tag?: string;
  page?: string;
  sort?: string;
};

export default async function AiResourcesLibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibraryParams>;
}) {
  const actor = await requireAiResourceUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = parseSort(params.sort);
  const where = buildWhere(actor, params);

  const [total, resources, facets, favorites, likes] = await Promise.all([
    prisma.aiResource.count({ where }),
    prisma.aiResource.findMany({
      where,
      include: {
        createdBy: { select: { username: true } },
        _count: { select: { favorites: true, likes: true } },
      },
      orderBy: buildOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getPublishedCatalogFacets(),
    prisma.aiResourceFavorite.findMany({
      where: { userId: actor.userId },
      select: { resourceId: true },
    }),
    prisma.aiResourceLike.findMany({
      where: { userId: actor.userId },
      select: { resourceId: true },
    }),
  ]);

  const { typeCounts, quickTags } = facets;
  const favoriteIds = new Set(favorites.map((f) => f.resourceId));
  const likedIds = new Set(likes.map((item) => item.resourceId));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="main home">
      <div className="catalog-layout">
        <ResourceSidebar
          currentType={params.type}
          counts={typeCounts}
          q={params.q}
          tag={params.tag}
          sort={sort}
        />
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
                  <Link className="button" href={pageHref(params, page - 1, sort)}>
                    上一页
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link className="button" href={pageHref(params, page + 1, sort)}>
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

function parseSort(value?: string): LibrarySort {
  if (value && (SORT_OPTIONS as readonly string[]).includes(value)) {
    return value as LibrarySort;
  }
  return 'views';
}

function buildOrderBy(sort: LibrarySort): Prisma.AiResourceOrderByWithRelationInput[] {
  if (sort === 'likes') {
    return [{ likes: { _count: 'desc' } }, { updatedAt: 'desc' }];
  }
  if (sort === 'favorites') {
    return [{ favorites: { _count: 'desc' } }, { updatedAt: 'desc' }];
  }
  return [{ viewCount: 'desc' }, { updatedAt: 'desc' }];
}

function pageHref(params: LibraryParams, page: number, sort: LibrarySort) {
  const next = new URLSearchParams();
  if (params.type) next.set('type', params.type);
  if (params.q?.trim()) next.set('q', params.q.trim());
  if (params.tag?.trim()) next.set('tag', params.tag.trim());
  if (sort !== 'views') next.set('sort', sort);
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `/ai-resources/library?${query}` : '/ai-resources/library';
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
