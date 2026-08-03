import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewResolved } from '@/lib/dingtalk/notify-review';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { fromJsonObject } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canActOnReviewRequest, canReview } from '@/modules/ai-resources/policy';
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
    const review = await db.aiResourceReviewRequest.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ error: '审批单不存在。' }, { status: 404 });
    }
    if (!canActOnReviewRequest(actor, review)) {
      return NextResponse.json(
        {
          error: review.requesterId === actor.userId
            ? '不能审批自己提交的申请（仅管理员可自审）。'
            : '该审批单已指定其他审批人。',
        },
        { status: 403 },
      );
    }

    const result = await db.$transaction(async (tx) => {
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

      if (review.type === 'ARCHIVE') {
        if (!review.resourceId) {
          throw new AiResourceError('删除审批缺少资源。', 409, 'MISSING_RESOURCE');
        }
        const existing = await tx.aiResource.findUnique({ where: { id: review.resourceId } });
        if (!existing) {
          throw new AiResourceError('资源不存在。', 404, 'NOT_FOUND');
        }
        if (existing.status === 'ARCHIVED') {
          throw new AiResourceError('资源已归档。', 409, 'ALREADY_ARCHIVED');
        }

        const resource = await tx.aiResource.update({
          where: { id: existing.id },
          data: {
            archivedFromStatus: existing.status,
            status: 'ARCHIVED',
          },
        });

        await tx.aiResourceUpdateLog.create({
          data: {
            resourceId: resource.id,
            actorId: review.requesterId,
            reviewerId: actor.userId,
            reviewId: review.id,
            action: 'ARCHIVE',
            result: 'APPROVED',
            updateSummary: review.updateSummary,
            changedFields: 'status',
          },
        });

        const handled = await tx.aiResourceReviewRequest.findUniqueOrThrow({ where: { id: review.id } });
        return { resource, review: handled };
      }

      const proposedData = toDbResourceData(fromJsonObject(review.proposedData));
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

    scheduleReviewResolved(result.review.id, { publish: true });
    return NextResponse.json(result);
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
