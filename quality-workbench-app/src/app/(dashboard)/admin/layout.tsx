// admin/layout.tsx — 管理员后台路由组 (F5.S1)
import { getSession } from '@/platform/auth/auth.config';
import { getProjectAdminAccess } from '@/lib/db/project-admin-access';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/');
  const access = await getProjectAdminAccess(session);
  if (access.kind === 'none') redirect('/');
  return <>{children}</>;
}
