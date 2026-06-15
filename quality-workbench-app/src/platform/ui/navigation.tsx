import Link from 'next/link';
import { getEnabledComponents } from '@/platform/permissions/component-guard';
import { getSession } from '@/platform/auth/auth.config';

export async function DynamicNav() {
  const session = await getSession();
  const components = await getEnabledComponents();
  const isAdmin = session?.role === 'admin';
  const businessLinks = components.filter((component) => (
    component.path.startsWith('/flows') &&
    component.enabled &&
    !component.path.includes('[') &&
    component.path !== '/flows/npq/projects' &&
    component.path !== '/flows/npq/todos' &&
    component.path !== '/flows/npq/tasks' &&
    component.path !== '/flows/npq/activities'
  ));
  const adminLinks = components
    .filter((component) => (
      component.path.startsWith('/admin') &&
      component.enabled &&
      component.path !== '/admin/positions' &&
      component.path !== '/admin/projects'
    ))
    .map((component) => component.path === '/admin/users' ? { ...component, name: '用户管理' } : component);

  return (
    <nav className="flex flex-col gap-1">
      <SectionHeader>业务</SectionHeader>
      <NavLink href="/workbench" label="个人项目工作台" />
      {businessLinks.map((component) => (
        <NavLink key={component.id} href={component.path} label={component.name} />
      ))}

      {isAdmin && adminLinks.length > 0 && (
        <>
          <div className="mt-4" />
          <SectionHeader>后台配置</SectionHeader>
          <NavLink href="/admin/projects" label="项目管理" />
          {adminLinks.map((component) => (
            <NavLink key={component.id} href={component.path} label={component.name} />
          ))}
        </>
      )}
    </nav>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ws-sidebar-text/50">
      {children}
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-ws-sidebar-text transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}
