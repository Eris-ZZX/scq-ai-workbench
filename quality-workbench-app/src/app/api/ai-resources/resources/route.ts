import type { Prisma } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const filters: Prisma.AiResourceWhereInput[] = [visibleResourceWhere(actor)];
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

    const resources = await prisma.aiResource.findMany({
      where: { AND: filters },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, username: true } },
      },
      take: 100,
    });

    return NextResponse.json({ resources });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
