import { db } from '@/lib/database';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { FavoritesBoard } from '@/modules/ai-resources/ui/favorites-board';

export default async function FavoritesPage() {
  const actor = await requireAiResourceUser();

  const [favorites, tags] = await Promise.all([
    db.aiResourceFavorite.findMany({
      where: { userId: actor.userId },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            type: true,
            summary: true,
            resourceUrl: true,
            extension: true,
            status: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    db.aiResourceFavoriteTag.findMany({
      where: { userId: actor.userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    }),
  ]);

  const items = favorites
    .filter((favorite) => favorite.resource.status === 'PUBLISHED')
    .map((favorite) => ({
      favoriteId: favorite.id,
      id: favorite.resource.id,
      name: favorite.resource.name,
      type: favorite.resource.type,
      summary: favorite.resource.summary,
      resourceUrl: favorite.resource.resourceUrl,
      extension: favorite.resource.extension,
      tagId: favorite.tagId,
    }));

  return (
    <main className="main favorites-page">
      <FavoritesBoard initialItems={items} initialTags={tags} />
    </main>
  );
}
