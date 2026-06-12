import Link from 'next/link';
import { getEnabledComponents } from '@/platform/permissions/component-guard';
import { getSession } from '@/platform/auth/auth.config';

export async function DynamicNav() {
  const session = await getSession();
  const components = await getEnabledComponents();
  const isAdmin = session?.role === 'admin';
  const adminLinks = components
    .filter((component) => component.path.startsWith('/admin') && component.enabled && component.path !== '/admin/positions')
    .map((component) => component.path === '/admin/users' ? { ...component, name: '用户管理' } : component);

  return (
    <nav className="flex flex-col gap-1">
      <SectionHeader>业务</SectionHeader>
      <NavLink href="/workbench" label="工作台" />

      {isAdmin && adminLinks.length > 0 && (
        <>
          <div className="mt-4" />
          <SectionHeader>后台配置</SectionHeader>
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
