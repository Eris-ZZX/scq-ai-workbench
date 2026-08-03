import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/database';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';

const favoriteToggleSchema = z.object({
  resourceId: z.string().min(1),
});

const favoriteReorderSchema = z.object({
  orderedResourceIds: z.array(z.string().min(1)).min(1),
});

const favoriteGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        tagId: z.string().min(1).nullable(),
        resourceIds: z.array(z.string().min(1)),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();

    const payload = favoriteToggleSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: '参数不正确。' }, { status: 400 });
    }

    const { resourceId } = payload.data;

    const resource = await db.aiResource.findUnique({ where: { id: resourceId } });
    if (!resource) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.aiResourceFavorite.findUnique({
        where: { userId_resourceId: { userId: actor.userId, resourceId } },
      });

      if (existing) {
        await tx.aiResourceFavorite.delete({ where: { id: existing.id } });
      } else {
        const max = await tx.aiResourceFavorite.aggregate({
          where: { userId: actor.userId },
          _max: { sortOrder: true },
        });
        await tx.aiResourceFavorite.create({
          data: {
            userId: actor.userId,
            resourceId,
            sortOrder: (max._max.sortOrder ?? -1) + 1,
          },
        });
      }

      const favoriteCount = await tx.aiResourceFavorite.count({ where: { resourceId } });
      return { favorited: !existing, favoriteCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();
    const body = await request.json().catch(() => null);

    const groupsPayload = favoriteGroupsSchema.safeParse(body);
    if (groupsPayload.success) {
      return persistFavoriteGroups(actor.userId, groupsPayload.data.groups);
    }

    const reorderPayload = favoriteReorderSchema.safeParse(body);
    if (!reorderPayload.success) {
      return NextResponse.json({ error: '参数不正确。' }, { status: 400 });
    }

    const { orderedResourceIds } = reorderPayload.data;
    const uniqueIds = Array.from(new Set(orderedResourceIds));
    if (uniqueIds.length !== orderedResourceIds.length) {
      return NextResponse.json({ error: '排序列表包含重复项。' }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const favorites = await tx.aiResourceFavorite.findMany({
        where: { userId: actor.userId },
        select: { id: true, resourceId: true },
      });

      if (favorites.length !== orderedResourceIds.length) {
        throw Object.assign(new Error('排序列表与收藏不一致'), { status: 400 });
      }

      const favoriteByResource = new Map(favorites.map((item) => [item.resourceId, item.id]));
      for (const resourceId of orderedResourceIds) {
        if (!favoriteByResource.has(resourceId)) {
          throw Object.assign(new Error('排序列表包含无效资源'), { status: 400 });
        }
      }

      await Promise.all(
        orderedResourceIds.map((resourceId, index) =>
          tx.aiResourceFavorite.update({
            where: { id: favoriteByResource.get(resourceId)! },
            data: { sortOrder: index },
          }),
        ),
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 400) {
      const message = error instanceof Error ? error.message : '请求无效';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return aiResourceErrorResponse(error);
  }
}

async function persistFavoriteGroups(
  userId: string,
  groups: Array<{ tagId: string | null; resourceIds: string[] }>,
) {
  const flatIds = groups.flatMap((group) => group.resourceIds);
  const uniqueIds = Array.from(new Set(flatIds));
  if (uniqueIds.length !== flatIds.length) {
    return NextResponse.json({ error: '分组列表包含重复资源。' }, { status: 400 });
  }

  const tagIds = groups.map((group) => group.tagId).filter((id): id is string => !!id);
  const uniqueTagIds = Array.from(new Set(tagIds));

  await db.$transaction(async (tx) => {
    const favorites = await tx.aiResourceFavorite.findMany({
      where: { userId },
      select: { id: true, resourceId: true },
    });
    if (favorites.length !== uniqueIds.length) {
      throw Object.assign(new Error('分组列表与收藏不一致'), { status: 400 });
    }

    const favoriteByResource = new Map(favorites.map((item) => [item.resourceId, item.id]));
    for (const resourceId of uniqueIds) {
      if (!favoriteByResource.has(resourceId)) {
        throw Object.assign(new Error('分组列表包含无效资源'), { status: 400 });
      }
    }

    if (uniqueTagIds.length) {
      const ownedTags = await tx.aiResourceFavoriteTag.findMany({
        where: { userId, id: { in: uniqueTagIds } },
        select: { id: true },
      });
      if (ownedTags.length !== uniqueTagIds.length) {
        throw Object.assign(new Error('分组列表包含无效标签'), { status: 400 });
      }
    }

    let sortOrder = 0;
    const updates: Array<Promise<unknown>> = [];
    for (const group of groups) {
      for (const resourceId of group.resourceIds) {
        updates.push(
          tx.aiResourceFavorite.update({
            where: { id: favoriteByResource.get(resourceId)! },
            data: { tagId: group.tagId, sortOrder },
          }),
        );
        sortOrder += 1;
      }
    }
    await Promise.all(updates);
  });

  return NextResponse.json({ ok: true });
}
