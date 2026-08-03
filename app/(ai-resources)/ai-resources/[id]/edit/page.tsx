import { notFound } from 'next/navigation';
import { db } from '@/lib/database';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { canEditResource } from '@/modules/ai-resources/policy';
import { ResourceForm } from '@/modules/ai-resources/ui/resource-form';

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAiResourceUser();
  const { id } = await params;
  const resource = await db.aiResource.findUnique({ where: { id } });
  if (!resource || !canEditResource(actor, resource)) notFound();

  const directUpdate = actor.isEffectiveAdmin;

  return (
    <main className="main">
      <ResourceForm resource={resource} directUpdate={directUpdate} />
    </main>
  );
}
