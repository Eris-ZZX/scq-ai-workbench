'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShieldCheck, UserCog, UsersRound } from 'lucide-react';

type User = {
  id: string;
  status: string;
};

export default function AdminUsersDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const usersRes = await fetch('/api/admin/users');
        if (cancelled) return;
        if (usersRes.ok) setUsers(await usersRes.json());
        else setError('加载用户数据失败，请刷新后重试。');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载用户数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const activeUsers = useMemo(() => users.filter((user) => user.status === 'active').length, [users]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            Admin / Users
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">用户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            维护用户账号状态、系统权限。岗位由钉钉登录自动同步，无需手动管理。
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <EntryCard
            href="/admin/users/accounts"
            icon={<UserCog className="h-5 w-5" />}
            title="用户管理"
            desc="维护账号状态、系统权限。岗位由钉钉登录自动获取，无需手动分配。"
            meta={`${users.length} 个账号，${activeUsers} 个启用`}
          />
        </section>
      </div>
    </div>
  );
}

function EntryCard({
  href,
  icon,
  title,
  desc,
  meta,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-white p-5 shadow-sm transition hover:border-ws-blue hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ws-blue/10 text-ws-blue">
          {icon}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-ws-blue" />
      </div>
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
      <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{meta}</div>
    </Link>
  );
}
