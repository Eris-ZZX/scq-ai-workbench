import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewSubmitted, onReworkHandled } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { toJsonString } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canResubmitReview, diffKeys } from '@/modules/ai-resources/policy';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const existing = await db.aiResourceReviewRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '审批单不存在。' }, { status: 404 });
    }
    if (!canResubmitReview(actor, existing)) {
      return NextResponse.json({ error: '仅提交人可对被驳回单据重新提交。' }, { status: 403 });
    }

    if (existing.type === 'ARCHIVE') {
      const body = (await request.json().catch(() => null)) as {
        updateSummary?: string;
        reviewerId?: string;
      } | null;
      const updateSummary = body?.updateSummary?.trim() ?? '';
      const reviewerId = body?.reviewerId?.trim() ?? '';
      if (updateSummary.length < 4 || !reviewerId) {
        return NextResponse.json({ error: '请填写变更说明并选择审批人。' }, { status: 400 });
      }
      await assertAssignableReviewer(actor, reviewerId);

      await onReworkHandled(existing.id);

      const review = await db.aiResourceReviewRequest.update({
        where: { id },
        data: {
          status: 'PENDING',
          rejectReason: null,
          reviewedAt: null,
          reviewerId,
          updateSummary,
          dingtalkTodoId: null,
          dingtalkTodoUnionId: null,
          dingtalkReworkTodoId: null,
          dingtalkReworkTodoUnionId: null,
        },
      });

      scheduleReviewSubmitted(review.id);
      return NextResponse.json({ review });
    }

    const payload = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    await assertAssignableReviewer(actor, payload.data.reviewerId);

    const proposedData = {
      name: payload.data.resource.name,
      type: payload.data.resource.type,
      summary: payload.data.resource.summary,
      tags: payload.data.resource.tags,
      ownerName: payload.data.resource.ownerName,
      visibilityScope: payload.data.resource.visibilityScope,
      status: payload.data.resource.status,
      resourceUrl: payload.data.resource.resourceUrl || null,
      content: payload.data.resource.content,
      attachments: payload.data.resource.attachments,
      extractedText: payload.data.resource.extractedText,
      extension: payload.data.resource.extension,
    };

    let changedFields = Object.keys(proposedData).join(',');
    if (existing.type === 'UPDATE' && existing.resourceId) {
      const resource = await db.aiResource.findUnique({ where: { id: existing.resourceId } });
      if (resource) {
        changedFields = diffKeys(
          {
            name: resource.name,
            type: resource.type,
            summary: resource.summary,
            tags: resource.tags,
            ownerName: resource.ownerName,
            visibilityScope: resource.visibilityScope,
            status: resource.status,
            resourceUrl: resource.resourceUrl,
            content: resource.content,
            attachments: resource.attachments,
            extractedText: resource.extractedText,
          },
          proposedData,
        ).join(',');
      }
    }

    await onReworkHandled(existing.id);

    const claimed = await db.aiResourceReviewRequest.updateMany({
      where: { id, status: 'REJECTED', requesterId: actor.userId },
      data: {
        status: 'PENDING',
        rejectReason: null,
        reviewedAt: null,
        reviewerId: payload.data.reviewerId,
        proposedData: toJsonString(proposedData),
        updateSummary: payload.data.updateSummary,
        changedFields,
        dingtalkTodoId: null,
        dingtalkTodoUnionId: null,
        dingtalkReworkTodoId: null,
        dingtalkReworkTodoUnionId: null,
      },
    });

    if (claimed.count === 0) {
      throw new AiResourceError('单据状态已变化，无法重新提交。', 409, 'CONFLICT');
    }

    const review = await db.aiResourceReviewRequest.findUniqueOrThrow({ where: { id } });
    scheduleReviewSubmitted(review.id);
    return NextResponse.json({ review });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
