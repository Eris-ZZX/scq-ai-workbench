// admin/layout.tsx — 管理员后台路由组 (F5.S1)
import { getSession } from '@/platform/auth/auth.config';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/');
  return <>{children}</>;
}
