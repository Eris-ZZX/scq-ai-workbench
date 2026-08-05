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
} from '@/modules/ai-resources/audit';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { withResolvedResourceOwner } from '@/modules/ai-resources/resource-data';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();
    const auditContext = getAuditRequestContext(request);

    const payload = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    await assertAssignableReviewer(actor, payload.data.reviewerId);
    const normalizedResource = await withResolvedResourceOwner(payload.data.resource);

    const review = await db.$transaction(async (tx) => {
      const createdReview = await tx.aiResourceReviewRequest.create({
        data: {
          type: 'CREATE',
          requesterId: actor.userId,
          reviewerId: payload.data.reviewerId,
          proposedData: toJsonString(normalizeResourceData(normalizedResource)),
          updateSummary: payload.data.updateSummary,
          changedFields: Object.keys(payload.data.resource).join(','),
        },
      });
      await appendAiResourceAuditLog({
        actorId: actor.userId,
        actorUsername: actor.username,
        action: AI_RESOURCE_AUDIT_ACTIONS.REVIEW_SUBMIT,
        targetType: 'REVIEW',
        targetId: createdReview.id,
        reviewId: createdReview.id,
        result: 'SUCCESS',
        reason: payload.data.updateSummary,
        after: {
          type: 'CREATE',
          resourceName: normalizedResource.name,
          resourceType: normalizedResource.type,
          ownerId: normalizedResource.ownerId,
          ownerName: normalizedResource.ownerName,
          changedFields: Object.keys(payload.data.resource),
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

function normalizeResourceData<T extends { resourceUrl?: string | null }>(resource: T) {
  return {
    ...resource,
    resourceUrl: resource.resourceUrl || null,
  };
}
