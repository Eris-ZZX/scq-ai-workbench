import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Boxes,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Gauge,
  Library,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/platform/auth/auth.config';
import { isPlatformAdmin } from '@/platform/permissions/system-admin';

const testApps: Array<{ href: string; title: string; icon: LucideIcon }> = [
  { href: '/portal/coming-soon/pqm', title: 'PQM（测试）', icon: ClipboardCheck },
  { href: '/portal/coming-soon/sqm', title: 'SQM（测试）', icon: Gauge },
  { href: '/portal/coming-soon/qcm', title: 'QCM（测试）', icon: Wrench },
  { href: '/portal/coming-soon/lab', title: '实验室（测试）', icon: FlaskConical },
  { href: '/portal/coming-soon/ems', title: 'EMS（测试）', icon: Boxes },
];

export default async function PortalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">选择要进入的应用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            已登录为 {session.displayName} · 供应链质量部统一入口
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PortalAppCard
            href="/ai-resources"
            icon={Library}
            title="AI 资源库"
            description="部门 AI 应用、Agent、Skill、Prompt 与规范目录"
          />
          <PortalAppCard
            href="/workbench"
            icon={FolderKanban}
            title="NPQ工作台"
            description="项目活动、待办与 NPQ 流程管理（测试）"
          />
          {testApps.map((app) => (
            <PortalAppCard key={app.href} {...app} description="应用功能正在搭建中" />
          ))}
          {isPlatformAdmin(session) ? (
            <PortalAppCard
              href="/portal/platform-admin"
              icon={ShieldCheck}
              title="平台后台管理"
              description="统一维护平台用户、权限和组织映射"
            />
          ) : null}
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

function PortalAppCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-white p-4 shadow-sm transition hover:border-primary"
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-base font-semibold text-foreground">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
