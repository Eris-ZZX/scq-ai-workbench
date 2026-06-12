import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DynamicNav } from '@/platform/ui/navigation';
import { getSession } from '@/platform/auth/auth.config';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-ws-sidebar-bg text-ws-sidebar-text">
        <Link href="/workbench" className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-ws-blue to-ws-green text-xs font-bold text-white">
            SCQ
          </div>
          <div>
            <div className="text-sm font-semibold text-white">供应链质量部</div>
            <div className="text-xs text-ws-sidebar-text/60">质量项目工作台</div>
          </div>
        </Link>

        <div className="flex-1 px-2 py-3">
          <DynamicNav />
        </div>

        <div className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ws-blue text-xs font-bold text-white">
                {(session.displayName ?? session.username).charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white">{session.displayName ?? session.username}</div>
                <div className="text-xs text-ws-sidebar-text/60">{session.role === 'admin' ? '系统管理员' : '项目成员'}</div>
              </div>
              <Link href="/workbench" className="ml-auto rounded p-1 text-ws-sidebar-text/60 transition hover:text-white" title="工作台">
                首页
              </Link>
            </div>
            <div className="mt-2 flex gap-1 text-xs">
              {session.role === 'admin' && (
                <Link href="/admin" className="rounded px-2 py-1 text-ws-sidebar-text/60 transition hover:bg-white/10 hover:text-white">
                  后台
                </Link>
              )}
              <form action="/api/auth/logout" method="POST" className="contents">
                <button type="submit" className="rounded px-2 py-1 text-ws-sidebar-text/60 transition hover:bg-white/10 hover:text-white">
                  登出
                </button>
              </form>
            </div>
          </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
