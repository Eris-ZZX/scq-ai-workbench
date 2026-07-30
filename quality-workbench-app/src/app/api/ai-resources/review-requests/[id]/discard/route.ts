import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { onReworkHandled } from '@/lib/dingtalk/notify-review';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canDiscardReview } from '@/modules/ai-resources/policy';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const existing = await prisma.aiResourceReviewRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '审批单不存在。' }, { status: 404 });
    }
    if (!canDiscardReview(actor, existing)) {
      return NextResponse.json({ error: '仅提交人可废弃被驳回的单据。' }, { status: 403 });
    }

    await onReworkHandled(id);

    const claimed = await prisma.aiResourceReviewRequest.updateMany({
      where: { id, status: 'REJECTED', requesterId: actor.userId },
      data: {
        status: 'DISCARDED',
        reviewedAt: new Date(),
        dingtalkReworkTodoId: null,
        dingtalkReworkTodoUnionId: null,
      },
    });

    if (claimed.count === 0) {
      throw new AiResourceError('单据状态已变化，无法废弃。', 409, 'CONFLICT');
    }

    const review = await prisma.aiResourceReviewRequest.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ review });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
