import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canAdmin } from '@/modules/ai-resources/policy';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const comment = await prisma.aiResourceComment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!comment) {
      return NextResponse.json({ error: '评论不存在。' }, { status: 404 });
    }

    if (comment.userId !== actor.userId && !canAdmin(actor)) {
      return NextResponse.json({ error: '无权删除该评论。' }, { status: 403 });
    }

    await prisma.aiResourceComment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
