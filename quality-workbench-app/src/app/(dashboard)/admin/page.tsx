import Link from 'next/link';

export default function AdminHome() {
  const links = [
    { href: '/admin/templates', label: '模板中心', desc: '维护 NPQ 活动模板、版本和三级结构。' },
    { href: '/admin/users', label: '用户管理', desc: '查看用户与岗位仪表盘，并进入角色管理或用户账号维护。' },
    { href: '/admin/components', label: '功能组件管理', desc: '启用或停用后台与业务入口。' },
    { href: '/admin/observability', label: '运行日志', desc: '查看请求、错误和用户动作记录。' },
  ];

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin Config</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">配置中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              后台用于维护模板、用户岗位、组件和运行日志；日常项目处理请回到个人工作台。
            </p>
          </div>
          <Link href="/workbench" className="rounded-md border border-border bg-white px-3 py-2 text-sm hover:border-primary">
            返回个人工作台
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-border bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <h2 className="font-semibold text-foreground">{link.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
