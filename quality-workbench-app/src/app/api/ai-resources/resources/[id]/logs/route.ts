import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const resource = await prisma.aiResource.findFirst({
      where: {
        id,
        AND: [visibleResourceWhere(actor)],
      },
    });

    if (!resource) {
      return NextResponse.json({ error: '资源不存在或你无权查看。' }, { status: 404 });
    }

    const logs = await prisma.aiResourceUpdateLog.findMany({
      where: { resourceId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, username: true } },
        reviewer: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
