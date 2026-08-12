import { requirePlatformPrincipalPage } from '@/platform/apps/access';
import { getPortalAppGroups } from '@/platform/apps/registry';
import { PortalAppCard } from '@/components/platform/portal-app-card';

export default async function PortalPage() {
  const principal = await requirePlatformPrincipalPage('/portal');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">选择要进入的应用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            已登录为 {principal.displayName} · 供应链质量部统一入口
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(await getPortalAppGroups(principal.isPlatformAdmin)).map(({ app, children }) => (
            <PortalAppCard
              key={app.id}
              href={children.length > 0 ? `/portal/apps/${app.id}` : app.href}
              icon={app.icon}
              title={app.state === 'coming-soon' ? `${app.title}（测试）` : app.title}
              description={app.description}
            />
          ))}
        </div>

        <form action="/api/auth/logout" method="POST" className="mt-8 text-center">
          <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            退出登录
          </button>
        </form>
      </div>
    </div>
  );
}
