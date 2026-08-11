// (dashboard)/layout.tsx — 受保护的主应用路由组
import { requirePlatformAppPage } from '@/platform/apps/access';
import AppLayout from '@/platform/ui/layout/app-layout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { app, principal } = await requirePlatformAppPage('npq', '/workbench');
  return <AppLayout app={app} session={principal}>{children}</AppLayout>;
}
