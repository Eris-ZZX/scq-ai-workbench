import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewResolved } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import {
  AI_RESOURCE_AUDIT_ACTIONS,
  appendAiResourceAuditLog,
  getAuditRequestContext,
} from '@/modules/ai-resources/audit';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canActOnReviewRequest, canReview } from '@/modules/ai-resources/policy';
import { rejectSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const auditContext = getAuditRequestContext(request);
    if (!canReview(actor)) {
      return NextResponse.json({ error: '你没有审批权限。' }, { status: 403 });
    }

    const payload = rejectSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
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
            action: review.type === 'CREATE' ? 'CREATE' : review.type === 'ARCHIVE' ? 'ARCHIVE' : 'UPDATE',
            result: 'REJECTED',
            updateSummary: `驳回：${payload.data.reason}`,
            changedFields: review.changedFields,
          },
        });
      }

      await appendAiResourceAuditLog({
        actorId: actor.userId,
        actorUsername: actor.username,
        action: AI_RESOURCE_AUDIT_ACTIONS.REVIEW_REJECT,
        targetType: 'REVIEW',
        targetId: review.id,
        resourceId: review.resourceId,
        reviewId: review.id,
        result: 'REJECTED',
        reason: payload.data.reason,
        before: { status: 'PENDING' },
        after: {
          status: 'REJECTED',
          reviewerId: actor.userId,
          reason: payload.data.reason,
        },
        ...auditContext,
      }, tx);
      return handled;
    });

    scheduleReviewResolved(result.id, { publish: false });
    return NextResponse.json({ review: result });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
