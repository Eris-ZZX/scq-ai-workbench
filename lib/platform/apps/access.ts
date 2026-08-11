import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';
import { canAccessPlatformApp, getPlatformApp, type PlatformApp } from './manifest';
import { isPlatformAdmin } from '@/platform/permissions/system-admin';

export type PlatformPrincipal = NonNullable<Awaited<ReturnType<typeof getSession>>> & {
  isPlatformAdmin: boolean;
};

type PlatformApiError = {
  error: string;
  status: 401 | 403 | 404;
};

function toPrincipal(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): PlatformPrincipal {
  return {
    ...session,
    isPlatformAdmin: isPlatformAdmin(session),
  };
}

export async function requirePlatformPrincipalPage(nextPath = '/portal'): Promise<PlatformPrincipal> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return toPrincipal(session);
}

export async function requirePlatformPrincipalApi(): Promise<
  { principal: PlatformPrincipal } | PlatformApiError
> {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  return { principal: toPrincipal(session) };
}

export async function requirePlatformAppPage(
  appId: string,
  nextPath = '/portal',
): Promise<{ app: PlatformApp; principal: PlatformPrincipal }> {
  const app = getPlatformApp(appId);
  if (!app) notFound();

  const principal = await requirePlatformPrincipalPage(nextPath);
  if (!canAccessPlatformApp(app, principal.isPlatformAdmin)) redirect('/portal');

  return { app, principal };
}

export async function requirePlatformAppApi(
  appId: string,
): Promise<{ app: PlatformApp; principal: PlatformPrincipal } | PlatformApiError> {
  const app = getPlatformApp(appId);
  if (!app) return { error: '应用不存在', status: 404 };

  const result = await requirePlatformPrincipalApi();
  if ('error' in result) return result;
  if (!canAccessPlatformApp(app, result.principal.isPlatformAdmin)) {
    return { error: '无权访问该应用', status: 403 };
  }

  return { app, principal: result.principal };
}
