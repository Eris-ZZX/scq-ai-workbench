import { NextRequest, NextResponse } from 'next/server';
import { db, type QueryArgs } from '@/lib/database';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { isAiResourceStatus, isAiResourceType } from '@/modules/ai-resources/constants';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { visibleResourceWhere } from '@/modules/ai-resources/policy';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAiResourceUserApi();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const owner = searchParams.get('owner')?.trim();
    const tag = searchParams.get('tag')?.trim();

    const filters: QueryArgs[] = [visibleResourceWhere(actor)];
    if (type && isAiResourceType(type)) filters.push({ type });
    if (status && isAiResourceStatus(status)) filters.push({ status });
    if (owner) filters.push({ ownerName: { contains: owner } });
    if (tag) filters.push({ tags: { contains: tag } });
    if (q) {
      filters.push({
        OR: [
          { name: { contains: q } },
          { summary: { contains: q } },
          { content: { contains: q } },
          { extractedText: { contains: q } },
          { ownerName: { contains: q } },
          { tags: { contains: q } },
        ],
      });
    }

    const resources = await db.aiResource.findMany({
      where: { AND: filters },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
      take: 100,
    });

    return NextResponse.json({ resources });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
