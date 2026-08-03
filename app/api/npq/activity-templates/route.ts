import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { db } from '@/lib/database';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const templates = await db.activityTemplateSet.findMany({
    where: { isActive: true, latestPublishedVersionId: { not: null } },
    include: {
      latestPublishedVersion: {
        include: {
          stages: {
            include: {
              parents: { include: { children: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(templates.map((template) => {
    const stages = template.latestPublishedVersion?.stages ?? [];
    const parentCount = stages.reduce((sum: number, stage: any) => sum + stage.parents.length, 0);
    const childCount = stages.reduce((sum: number, stage: any) => sum + stage.parents.reduce((inner: number, parent: any) => inner + parent.children.length, 0), 0);
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      latestVersionId: template.latestPublishedVersionId,
      version: template.latestPublishedVersion?.version ?? null,
      stats: { stageCount: stages.length, parentCount, childCount },
    };
  }));
}
