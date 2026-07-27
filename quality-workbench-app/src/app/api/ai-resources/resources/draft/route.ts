import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { toJsonString } from '@/modules/ai-resources/json';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { assertWritableInTransaction } from '@/modules/ai-resources/maintenance';
import { reviewSubmissionSchema } from '@/modules/ai-resources/validation';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();

    const payload = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const review = await prisma.$transaction(async (tx) => {
      await assertWritableInTransaction(tx);
      return tx.aiResourceReviewRequest.create({
        data: {
          type: 'CREATE',
          requesterId: actor.userId,
          proposedData: toJsonString(normalizeResourceData(payload.data.resource)),
          updateSummary: payload.data.updateSummary,
          changedFields: Object.keys(payload.data.resource).join(','),
        },
      });
    });

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
