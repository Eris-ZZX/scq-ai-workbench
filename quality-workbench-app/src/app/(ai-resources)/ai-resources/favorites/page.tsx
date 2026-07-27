import Link from 'next/link';
import { Clock, Eye, Heart, Tags } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseList } from '@/modules/ai-resources/list-fields';
import { FavoriteToggle } from '@/modules/ai-resources/ui/favorite-toggle';
import { QuickLinks } from '@/modules/ai-resources/ui/quick-links';

export default async function FavoritesPage() {
  const actor = await requireAiResourceUser();

  const favorites = await prisma.aiResourceFavorite.findMany({
    where: { userId: actor.userId },
    include: {
      resource: {
        include: { createdBy: { select: { username: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const resources = favorites.map((f) => f.resource).filter((r) => r.status === 'PUBLISHED');

  return (
    <main className="main">
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
                <FavoriteToggle resourceId={resource.id} initialFavorited={true} />
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
          <div className="empty">
            你还没有收藏过资源。浏览资源库并点击 <Heart size={14} style={{ verticalAlign: 'middle' }} />{' '}
            图标即可收藏。
          </div>
        )}
      </section>
    </main>
  );
}
