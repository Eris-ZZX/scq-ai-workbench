import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { fromPrismaJsonObject } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canReview } from '@/modules/ai-resources/policy';
import { toDbResourceData } from '@/modules/ai-resources/resource-data';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    if (!canReview(actor)) {
      return NextResponse.json({ error: '你没有审批权限。' }, { status: 403 });
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
          status: 'APPROVED',
          reviewerId: actor.userId,
          reviewedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new AiResourceError('该审批单已经处理过。', 409, 'ALREADY_HANDLED');
      }

      const proposedData = toDbResourceData(fromPrismaJsonObject(review.proposedData));
      const resource =
        review.type === 'CREATE'
          ? await tx.aiResource.create({
              data: {
                ...proposedData,
                createdById: review.requesterId,
              },
            })
          : await tx.aiResource.update({
              where: { id: review.resourceId ?? '' },
              data: {
                ...proposedData,
                currentVersion: { increment: 1 },
              },
            });

      const handled = await tx.aiResourceReviewRequest.update({
        where: { id: review.id },
        data: { resourceId: resource.id },
      });

      await tx.aiResourceUpdateLog.create({
        data: {
          resourceId: resource.id,
          actorId: review.requesterId,
          reviewerId: actor.userId,
          reviewId: review.id,
          action: review.type,
          result: 'APPROVED',
          updateSummary: review.updateSummary,
          changedFields: review.changedFields,
        },
      });

      return { resource, review: handled };
    });

    return NextResponse.json(result);
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
