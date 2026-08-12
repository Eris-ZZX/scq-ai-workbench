import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePlatformPrincipalPage } from '@/platform/apps/access';
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
  if (group.children.length === 0) redirect(group.app.href);

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
          {group.children.map((child) => (
            <PortalAppCard
              key={child.id}
              href={child.href}
              icon={child.icon}
              title={child.state === 'coming-soon' ? `${child.title}（测试）` : child.title}
              description={child.description}
              compact
            />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href={group.app.href}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            进入主应用
          </Link>
        </div>
      </div>
    </div>
  );
}
