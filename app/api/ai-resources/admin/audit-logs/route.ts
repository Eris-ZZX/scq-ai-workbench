import { NextRequest, NextResponse } from 'next/server';
import { parsePagination, paginatedResponse } from '@/lib/pagination';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { getAiResourceAuditLogs } from '@/modules/ai-resources/audit';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';

export async function GET(request: NextRequest) {
  try {
    await requireAiResourceRoleApi('admin');
    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, skip } = parsePagination(searchParams);
    const result = await getAiResourceAuditLogs({
      actorId: searchParams.get('actorId') ?? undefined,
      actorUsername: searchParams.get('actor')?.trim() || undefined,
      action: searchParams.get('action') ?? undefined,
      targetType: searchParams.get('targetType') ?? undefined,
      resourceId: searchParams.get('resourceId') ?? undefined,
      result: searchParams.get('result') ?? undefined,
      start: searchParams.get('start') ?? undefined,
      end: searchParams.get('end') ?? undefined,
      limit: pageSize,
      offset: skip,
    });

    return NextResponse.json(paginatedResponse(result.items, result.total, page, pageSize));
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
