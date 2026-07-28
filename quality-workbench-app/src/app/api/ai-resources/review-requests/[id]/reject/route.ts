import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canReview } from '@/modules/ai-resources/policy';
import { rejectSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    if (!canReview(actor)) {
      return NextResponse.json({ error: '你没有审批权限。' }, { status: 403 });
    }

    const payload = rejectSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const { id } = await context.params;
    const review = await prisma.aiResourceReviewRequest.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ error: '审批单不存在。' }, { status: 404 });
    }
    if (review.requesterId === actor.userId) {
      return NextResponse.json({ error: '不能审批自己提交的申请。' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.aiResourceReviewRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewerId: actor.userId,
          reviewedAt: new Date(),
          rejectReason: payload.data.reason,
        },
      });

      if (claimed.count === 0) {
        throw new AiResourceError('该审批单已经处理过。', 409, 'ALREADY_HANDLED');
      }

      const handled = await tx.aiResourceReviewRequest.findUniqueOrThrow({ where: { id } });

      if (review.resourceId) {
        await tx.aiResourceUpdateLog.create({
          data: {
            resourceId: review.resourceId,
            actorId: review.requesterId,
            reviewerId: actor.userId,
            reviewId: review.id,
            action: review.type === 'CREATE' ? 'CREATE' : 'UPDATE',
            result: 'REJECTED',
            updateSummary: `驳回：${payload.data.reason}`,
            changedFields: review.changedFields,
          },
        });
      }

      return handled;
    });

    return NextResponse.json({ review: result });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
