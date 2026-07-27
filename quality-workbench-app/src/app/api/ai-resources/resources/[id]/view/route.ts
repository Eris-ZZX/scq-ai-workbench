import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { assertWritableInTransaction } from '@/modules/ai-resources/maintenance';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAiResourceUserApi();

    const { id } = await context.params;
    const existing = await prisma.aiResource.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await assertWritableInTransaction(tx);
      await tx.aiResource.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
