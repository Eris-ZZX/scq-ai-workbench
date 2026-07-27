import { ResourceForm } from '@/modules/ai-resources/ui/resource-form';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';

export default async function NewResourcePage() {
  await requireAiResourceUser();

  return (
    <main className="main">
      <ResourceForm />
    </main>
  );
}
