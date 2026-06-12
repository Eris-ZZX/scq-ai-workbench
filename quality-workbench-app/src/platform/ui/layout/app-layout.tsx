import { redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';
import { AppShell } from '@/platform/ui/layout/app-shell';
import { DynamicNav } from '@/platform/ui/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <AppShell session={session} nav={<DynamicNav />}>
      {children}
    </AppShell>
  );
}
