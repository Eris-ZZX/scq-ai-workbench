import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { db } from '@/lib/database';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { hostedHtmlOpenPath, parseHostedHtml } from '@/modules/ai-resources/hosted-html';
import { canViewResource, visibleResourceWhere } from '@/modules/ai-resources/policy';

/** 兼容旧链接：校验后跳到 HTML 直链 */
export default async function ResourceHtmlOpenPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAiResourceUser();
  const { id } = await params;

  const resource = await db.aiResource.findFirst({
    where: {
      id,
      AND: [visibleResourceWhere(actor)],
    },
    select: {
      id: true,
      extension: true,
      createdById: true,
      visibilityScope: true,
      visibleDeptIds: true,
      visibleUserIds: true,
    },
  });

  if (!resource || !canViewResource(actor, resource)) notFound();
  if (!parseHostedHtml(resource.extension)) notFound();

  redirect(hostedHtmlOpenPath(resource.id));
}
