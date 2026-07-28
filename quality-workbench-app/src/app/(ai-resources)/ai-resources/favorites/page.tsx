import { prisma } from '@/lib/prisma';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { FavoritesBoard } from '@/modules/ai-resources/ui/favorites-board';

export default async function FavoritesPage() {
  const actor = await requireAiResourceUser();

  const favorites = await prisma.aiResourceFavorite.findMany({
    where: { userId: actor.userId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          type: true,
          summary: true,
          resourceUrl: true,
          status: true,
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  const items = favorites
    .filter((favorite) => favorite.resource.status === 'PUBLISHED')
    .map((favorite) => ({
      favoriteId: favorite.id,
      id: favorite.resource.id,
      name: favorite.resource.name,
      type: favorite.resource.type,
      summary: favorite.resource.summary,
      resourceUrl: favorite.resource.resourceUrl,
    }));

  return (
    <main className="main favorites-page">
      <FavoritesBoard initialItems={items} />
    </main>
  );
}
