import { unstable_cache } from 'next/cache';
import { db } from '@/lib/database';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { isAiResourceType } from '@/modules/ai-resources/constants';

/** Sidebar type counts + quick tags; short TTL so publish still feels fresh. */
export const getPublishedCatalogFacets = unstable_cache(
  async () => {
    const [typeGroups, tagRows] = await Promise.all([
      db.aiResource.groupBy({
        by: ['type'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      }),
      db.$queryRaw<Array<{ tag: string }>>`
        SELECT DISTINCT trim(both FROM tag) AS tag
        FROM ai_resources AS r
        CROSS JOIN LATERAL unnest(string_to_array(r.tags, ',')) AS tag
        WHERE r.status = 'PUBLISHED'
          AND r.tags <> ''
          AND trim(both FROM tag) <> ''
        ORDER BY tag
      `,
    ]);

    const typeCounts = typeGroups.reduce<Partial<Record<AiResourceType, number>>>((counts, group) => {
      if (isAiResourceType(group.type)) {
        counts[group.type] = group._count._all;
      }
      return counts;
    }, {});

    return {
      typeCounts,
      quickTags: tagRows.map((row) => row.tag),
    };
  },
  ['ai-resources-published-catalog-facets'],
  { revalidate: 30 },
);
