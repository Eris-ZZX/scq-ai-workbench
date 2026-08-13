import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePlatformPrincipalPage } from '@/platform/apps/access';
import { getPlatformAppLaunch } from '@/platform/apps/launch';
import { getPortalAppGroups } from '@/platform/apps/registry';
import { PortalAppCard } from '@/components/platform/portal-app-card';

export default async function PortalAppChildrenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const principal = await requirePlatformPrincipalPage(`/portal/apps/${id}`);
  const group = (await getPortalAppGroups(principal.isPlatformAdmin))
    .find((item) => item.app.id === id);

  if (!group) notFound();
  if (group.children.length === 0) {
    const launch = await getPlatformAppLaunch(group.app);
    redirect(launch.enabled ? launch.href : '/portal');
  }
  const children = await Promise.all(group.children.map(async (child) => ({
    child,
    launch: await getPlatformAppLaunch(child),
  })));
  const parentLaunch = await getPlatformAppLaunch(group.app);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-5xl">
        <Link
          href="/portal"
          className="mb-5 inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          返回应用选择
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{group.app.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{group.app.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map(({ child, launch }) => (
            <PortalAppCard
              key={child.id}
              href={launch.href}
              icon={child.icon}
              title={child.state === 'coming-soon' ? `${child.title}（测试）` : child.title}
              description={child.description}
              compact
              external={launch.external}
              disabled={!launch.enabled}
            />
          ))}
        </div>

        <div className="mt-6 text-center">
          {parentLaunch.enabled ? (
            parentLaunch.external ? (
              <a
                href={parentLaunch.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                进入主应用
              </a>
            ) : (
              <Link
                href={parentLaunch.href}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                进入主应用
              </Link>
            )
          ) : (
            <span className="text-sm text-muted-foreground">主应用暂不可用</span>
          )}
        </div>
      </div>
    </div>
  );
}
