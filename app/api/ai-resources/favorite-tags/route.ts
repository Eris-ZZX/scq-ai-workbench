import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/database';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(20),
});

const patchTagSchema = z.union([
  z.object({
    orderedTagIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(20),
  }),
]);

export async function GET() {
  try {
    const actor = await requireAiResourceUserApi();
    const tags = await db.aiResourceFavoriteTag.findMany({
      where: { userId: actor.userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    });
    return NextResponse.json({ tags });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();
    const payload = createTagSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: '标签名称不正确。' }, { status: 400 });
    }

    const name = payload.data.name;
    const existing = await db.aiResourceFavoriteTag.findUnique({
      where: { userId_name: { userId: actor.userId, name } },
    });
    if (existing) {
      return NextResponse.json({ error: '已存在同名标签。' }, { status: 400 });
    }

    const max = await db.aiResourceFavoriteTag.aggregate({
      where: { userId: actor.userId },
      _max: { sortOrder: true },
    });

    const tag = await db.aiResourceFavoriteTag.create({
      data: {
        userId: actor.userId,
        name,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, name: true, sortOrder: true },
    });

    return NextResponse.json({ tag });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();
    const payload = patchTagSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: '参数不正确。' }, { status: 400 });
    }

    if ('orderedTagIds' in payload.data) {
      const { orderedTagIds } = payload.data;
      const uniqueIds = Array.from(new Set(orderedTagIds));
      if (uniqueIds.length !== orderedTagIds.length) {
        return NextResponse.json({ error: '标签排序包含重复项。' }, { status: 400 });
      }

      const tags = await db.aiResourceFavoriteTag.findMany({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (tags.length !== orderedTagIds.length) {
        return NextResponse.json({ error: '标签排序与现有标签不一致。' }, { status: 400 });
      }
      const owned = new Set(tags.map((tag) => tag.id));
      for (const id of orderedTagIds) {
        if (!owned.has(id)) {
          return NextResponse.json({ error: '标签排序包含无效项。' }, { status: 400 });
        }
      }

      await db.$transaction(async (tx) => {
        await Promise.all(
          orderedTagIds.map((id, index) =>
            tx.aiResourceFavoriteTag.update({
            where: { id },
            data: { sortOrder: index },
          }),
          ),
        );
      });

      return NextResponse.json({ ok: true });
    }

    const { id, name } = payload.data;
    const tag = await db.aiResourceFavoriteTag.findFirst({
      where: { id, userId: actor.userId },
    });
    if (!tag) {
      return NextResponse.json({ error: '标签不存在。' }, { status: 404 });
    }

    const conflict = await db.aiResourceFavoriteTag.findFirst({
      where: { userId: actor.userId, name, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json({ error: '已存在同名标签。' }, { status: 400 });
    }

    const updated = await db.aiResourceFavoriteTag.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, sortOrder: true },
    });

    return NextResponse.json({ tag: updated });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: '缺少标签 ID。' }, { status: 400 });
    }

    const tag = await db.aiResourceFavoriteTag.findFirst({
      where: { id, userId: actor.userId },
    });
    if (!tag) {
      return NextResponse.json({ error: '标签不存在。' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.aiResourceFavorite.updateMany({
        where: { userId: actor.userId, tagId: id },
        data: { tagId: null },
      });
      await tx.aiResourceFavoriteTag.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
