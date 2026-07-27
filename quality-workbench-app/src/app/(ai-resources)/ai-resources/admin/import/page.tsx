import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminImportForm } from '@/modules/ai-resources/ui/admin-import-form';
import { requireAiResourceRole } from '@/modules/ai-resources/guards';

export default async function AdminImportPage() {
  try {
    await requireAiResourceRole('admin');
  } catch {
    notFound();
  }

  return (
    <main className="main">
      <section className="page-head compact">
        <Link className="button" href="/ai-resources/admin">
          返回后台
        </Link>
      </section>

      <section className="panel admin-detail-panel">
        <AdminImportForm />
      </section>
    </main>
  );
}
