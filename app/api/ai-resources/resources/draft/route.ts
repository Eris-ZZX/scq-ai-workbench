import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewSubmitted } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { toJsonString } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();

    const payload = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    await assertAssignableReviewer(actor, payload.data.reviewerId);

    const review = await db.$transaction(async (tx) => {
      return tx.aiResourceReviewRequest.create({
        data: {
          type: 'CREATE',
          requesterId: actor.userId,
          reviewerId: payload.data.reviewerId,
          proposedData: toJsonString(normalizeResourceData(payload.data.resource)),
          updateSummary: payload.data.updateSummary,
          changedFields: Object.keys(payload.data.resource).join(','),
        },
      });
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
