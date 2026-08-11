import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { DEFAULT_LOG_PAGE_SIZE, paginatedResponse, parsePagination } from '@/lib/pagination';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;
    const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams, {
      pageSize: DEFAULT_LOG_PAGE_SIZE,
    });

    const resource = await db.aiResource.findFirst({
      where: {
        id,
        AND: [visibleResourceWhere(actor)],
      },
      select: { id: true },
    });

    if (!resource) {
      return NextResponse.json({ error: '资源不存在或你无权查看。' }, { status: 404 });
    }

    const [total, logs] = await Promise.all([
      db.aiResourceUpdateLog.count({ where: { resourceId: id } }),
      db.aiResourceUpdateLog.findMany({
        where: { resourceId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          actor: { select: { id: true, username: true, displayName: true } },
          reviewer: { select: { id: true, username: true, displayName: true } },
        },
      }),
    ]);

    return NextResponse.json(paginatedResponse(logs, total, page, pageSize));
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
