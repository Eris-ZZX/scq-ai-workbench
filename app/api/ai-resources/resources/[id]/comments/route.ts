import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/database';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canViewResource, visibleResourceWhere } from '@/modules/ai-resources/policy';

const COMMENT_LIMIT = 100;

const createCommentSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空。').max(1000, '评论最多 1000 字。'),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const resource = await db.aiResource.findFirst({
      where: { id, AND: [visibleResourceWhere(actor)] },
      select: {
        id: true,
        visibilityScope: true,
        visibleDeptIds: true,
        visibleUserIds: true,
        createdById: true,
      },
    });
    if (!resource || !canViewResource(actor, resource)) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }

    const comments = await db.aiResourceComment.findMany({
      where: { resourceId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: COMMENT_LIMIT,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({
      comments: comments.map((item) => ({
        id: item.id,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
        user: item.user,
      })),
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const payload = createCommentSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      const message = payload.error.issues[0]?.message ?? '参数不正确。';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const resource = await db.aiResource.findFirst({
      where: { id, AND: [visibleResourceWhere(actor)] },
      select: {
        id: true,
        status: true,
        visibilityScope: true,
        visibleDeptIds: true,
        visibleUserIds: true,
        createdById: true,
      },
    });
    if (!resource || !canViewResource(actor, resource)) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }
    if (resource.status === 'ARCHIVED') {
      return NextResponse.json({ error: '已归档资源不可评论。' }, { status: 400 });
    }

    const comment = await db.aiResourceComment.create({
      data: {
        resourceId: id,
        userId: actor.userId,
        content: payload.data.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user,
      },
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
