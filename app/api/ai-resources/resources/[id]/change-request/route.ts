import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewSubmitted } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { toJsonString } from '@/modules/ai-resources/json';
import {
  AI_RESOURCE_AUDIT_ACTIONS,
  appendAiResourceAuditLog,
  getAuditRequestContext,
  summarizeResource,
} from '@/modules/ai-resources/audit';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canEditResource, diffKeys } from '@/modules/ai-resources/policy';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { withResolvedResourceOwner } from '@/modules/ai-resources/resource-data';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const auditContext = getAuditRequestContext(request);
    const { id } = await context.params;

    const existing = await db.aiResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }
    if (!canEditResource(actor, existing)) {
      return NextResponse.json({ error: '你没有权限修改该资源。' }, { status: 403 });
    }

    const payload = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    await assertAssignableReviewer(actor, payload.data.reviewerId);
    const normalizedResource = await withResolvedResourceOwner(payload.data.resource);

    const proposedData = {
      name: normalizedResource.name,
      type: normalizedResource.type,
      summary: normalizedResource.summary,
      tags: normalizedResource.tags,
      ownerId: normalizedResource.ownerId,
      ownerName: normalizedResource.ownerName,
      visibilityScope: normalizedResource.visibilityScope,
      status: normalizedResource.status,
      resourceUrl: normalizedResource.resourceUrl || null,
      content: normalizedResource.content,
      attachments: normalizedResource.attachments,
      extractedText: normalizedResource.extractedText,
    };

    const changedFields = diffKeys(
      {
        name: existing.name,
        type: existing.type,
        summary: existing.summary,
        tags: existing.tags,
        ownerId: existing.ownerId,
        ownerName: existing.ownerName,
        visibilityScope: existing.visibilityScope,
        status: existing.status,
        resourceUrl: existing.resourceUrl,
        content: existing.content,
        attachments: existing.attachments,
        extractedText: existing.extractedText,
      },
      proposedData,
    );

    const review = await db.$transaction(async (tx) => {
      const createdReview = await tx.aiResourceReviewRequest.create({
        data: {
          type: 'UPDATE',
          requesterId: actor.userId,
          reviewerId: payload.data.reviewerId,
          resourceId: id,
          proposedData: toJsonString(proposedData),
          updateSummary: payload.data.updateSummary,
          changedFields: changedFields.join(','),
        },
      });
      await appendAiResourceAuditLog({
        actorId: actor.userId,
        actorUsername: actor.username,
        action: AI_RESOURCE_AUDIT_ACTIONS.REVIEW_SUBMIT,
        targetType: 'REVIEW',
        targetId: createdReview.id,
        resourceId: id,
        reviewId: createdReview.id,
        result: 'SUCCESS',
        reason: payload.data.updateSummary,
        before: summarizeResource(existing),
        after: {
          ...summarizeResource(proposedData),
          changedFields,
        },
        ...auditContext,
      }, tx);
      return createdReview;
    });

    scheduleReviewSubmitted(review.id);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
