import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';

const likeToggleSchema = z.object({
  resourceId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();

    const payload = likeToggleSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: '参数不正确。' }, { status: 400 });
    }

    const { resourceId } = payload.data;

    const resource = await prisma.aiResource.findUnique({ where: { id: resourceId } });
    if (!resource) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {

      const existing = await tx.aiResourceLike.findUnique({
        where: { userId_resourceId: { userId: actor.userId, resourceId } },
      });

      if (existing) {
        await tx.aiResourceLike.delete({ where: { id: existing.id } });
      } else {
        await tx.aiResourceLike.create({
          data: { userId: actor.userId, resourceId },
        });
      }

      const likeCount = await tx.aiResourceLike.count({ where: { resourceId } });
      return { liked: !existing, likeCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
