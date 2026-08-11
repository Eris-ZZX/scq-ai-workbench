import { ResourceForm } from '@/modules/ai-resources/ui/resource-form';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';

export default async function NewResourcePage() {
  const actor = await requireAiResourceUser();

  return (
    <main className="main">
      <ResourceForm initialOwnerId={actor.userId} initialOwnerName={actor.displayName} />
    </main>
  );
}
