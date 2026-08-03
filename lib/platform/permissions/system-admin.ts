import { redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';

export type SystemAdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function isPlatformAdmin(session: { role: string; platformRole?: string }) {
  return session.platformRole === 'admin' || (!session.platformRole && session.role === 'admin');
}

export async function requireSystemAdminPage(): Promise<SystemAdminSession> {
  const session = await getSession();
  if (!session) redirect('/login?next=%2Fportal%2Fusers');
  if (!isPlatformAdmin(session)) redirect('/portal');
  return session;
}

export async function requireSystemAdminApi() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 as const };
  if (!isPlatformAdmin(session)) return { error: '需要平台管理员权限', status: 403 as const };
  return { session };
}
