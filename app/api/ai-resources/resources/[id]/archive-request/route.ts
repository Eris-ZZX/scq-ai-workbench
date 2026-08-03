import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { scheduleReviewSubmitted } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { toJsonString } from '@/modules/ai-resources/json';
import { canRequestArchive } from '@/modules/ai-resources/policy';
import { assertAssignableReviewer } from '@/modules/ai-resources/reviewers';
import { archiveRequestSchema } from '@/modules/ai-resources/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const existing = await db.aiResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }
    if (!canRequestArchive(actor, existing)) {
      return NextResponse.json({ error: '只有上传者可以申请删除该资源。' }, { status: 403 });
    }

    const payload = archiveRequestSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }
    if (payload.data.confirmationName !== existing.name) {
      return NextResponse.json({ error: '确认名称与资源名称不一致。' }, { status: 400 });
    }

    await assertAssignableReviewer(actor, payload.data.reviewerId);

    const pending = await db.aiResourceReviewRequest.findFirst({
      where: {
        resourceId: id,
        type: 'ARCHIVE',
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (pending) {
      return NextResponse.json({ error: '该资源已有待审批的删除申请。' }, { status: 409 });
    }

    const review = await db.aiResourceReviewRequest.create({
      data: {
        type: 'ARCHIVE',
        requesterId: actor.userId,
        reviewerId: payload.data.reviewerId,
        resourceId: id,
        proposedData: toJsonString({
          name: existing.name,
          type: existing.type,
          summary: existing.summary,
          tags: existing.tags,
          ownerName: existing.ownerName,
          status: existing.status,
          content: existing.content,
          resourceUrl: existing.resourceUrl,
          attachments: existing.attachments,
          extension: existing.extension,
        }),
        updateSummary: payload.data.updateSummary,
        changedFields: 'status',
      },
    });

    scheduleReviewSubmitted(review.id);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
