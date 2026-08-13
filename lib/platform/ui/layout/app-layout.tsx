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
  // AppShell is a Client Component — pass only serializable fields.
  // PlatformApp also carries `icon` (a Lucide component function); forwarding the
  // whole object triggers RSC error digest 1114158160 at runtime.
  return (
    <AppShell
      app={{ href: app.href, title: app.title }}
      session={{
        username: session.username,
        displayName: session.displayName,
        platformRole: session.platformRole,
        role: session.role,
      }}
      nav={<DynamicNav />}
    >
      {children}
    </AppShell>
  );
}
