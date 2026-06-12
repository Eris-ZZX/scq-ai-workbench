'use client';
import { useEffect, useMemo, useState } from 'react';

type Comp = { id: string; name: string; path: string; enabled: boolean; order: number };

export default function AdminComponentsPage() {
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/admin/components');
    if (res.ok) setComps(await res.json());
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const visibleComps = useMemo(() => comps
    .filter((component) => component.path !== '/admin/positions')
    .map((component) => component.path === '/admin/users'
      ? { ...component, name: '用户管理', path: '/admin/users' }
      : component),
  [comps]);

  async function toggle(id: string, enabled: boolean) {
    await fetch('/api/admin/components', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) });
    load();
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">功能组件管理</h1>
        <p className="mb-6 text-sm text-muted-foreground">控制后台与业务入口是否可见。旧“岗位角色”入口已合并到“用户管理”。</p>
        <div className="space-y-2">
          {visibleComps.map((component) => (
            <div key={component.id} className="flex items-center justify-between rounded-lg border border-border bg-white p-4">
              <div>
                <span className="font-medium">{component.name}</span>
                <span className="ml-3 font-mono text-xs text-muted-foreground">{component.path}</span>
              </div>
              <button onClick={() => toggle(component.id, !component.enabled)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${component.enabled ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'}`}>
                {component.enabled ? '已启用' : '已停用'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
