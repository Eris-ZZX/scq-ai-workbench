import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scheduleReviewSubmitted } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { toJsonString } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canEditResource, diffKeys } from '@/modules/ai-resources/policy';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const existing = await prisma.aiResource.findUnique({ where: { id } });
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
    };

    const changedFields = diffKeys(
      {
        name: existing.name,
        type: existing.type,
        summary: existing.summary,
        tags: existing.tags,
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

    const review = await prisma.$transaction(async (tx) => {
      return tx.aiResourceReviewRequest.create({
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
    });

    scheduleReviewSubmitted(review.id);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
