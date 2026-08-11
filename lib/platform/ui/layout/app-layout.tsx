import type { PlatformPrincipal } from '@/platform/apps/access';
import type { PlatformApp } from '@/platform/apps/manifest';
import { AppShell } from '@/platform/ui/layout/app-shell';
import { DynamicNav } from '@/platform/ui/navigation';

export default function AppLayout({
  children,
  app,
  session,
}: {
  children: React.ReactNode;
  app: Pick<PlatformApp, 'href' | 'title'>;
  session: PlatformPrincipal;
}) {
  return (
    <AppShell app={app} session={session} nav={<DynamicNav />}>
      {children}
    </AppShell>
  );
}
