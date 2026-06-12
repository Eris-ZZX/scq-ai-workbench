// (dashboard)/layout.tsx — 受保护的主应用路由组
import AppLayout from '@/platform/ui/layout/app-layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
