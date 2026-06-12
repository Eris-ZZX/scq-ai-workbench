'use client';

import Link from 'next/link';
import * as React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type AppShellSession = {
  username: string;
  role: string;
  displayName?: string;
};

export function AppShell({
  children,
  nav,
  session,
}: {
  children: React.ReactNode;
  nav: React.ReactNode;
  session: AppShellSession;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const displayName = session.displayName ?? session.username;
  const toggleLabel = collapsed ? '展开侧边栏' : '隐藏侧边栏';

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-x-hidden overflow-y-auto bg-ws-sidebar-bg text-ws-sidebar-text ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div
          className={`border-b border-white/10 ${
            collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'flex items-center gap-3 px-4 py-4'
          }`}
        >
          <Link
            href="/workbench"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ws-blue to-ws-green text-xs font-bold text-white"
            title="工作台"
          >
            SCQ
          </Link>
          {!collapsed && (
            <Link href="/workbench" className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">供应链质量部</div>
              <div className="truncate text-xs text-ws-sidebar-text/60">质量项目工作台</div>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ws-sidebar-text/75 transition hover:bg-white/10 hover:text-white"
            title={toggleLabel}
            aria-label={toggleLabel}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && <div className="flex-1 px-2 py-3">{nav}</div>}

        <div className="mt-auto border-t border-white/10 px-3 py-3">
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-blue text-xs font-bold text-white">
              {displayName.charAt(0)}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{displayName}</div>
                  <div className="text-xs text-ws-sidebar-text/60">
                    {session.role === 'admin' ? '系统管理员' : '项目成员'}
                  </div>
                </div>
                <Link href="/workbench" className="rounded p-1 text-ws-sidebar-text/60 transition hover:text-white" title="工作台">
                  首页
                </Link>
              </>
            )}
          </div>
          {!collapsed && (
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
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
