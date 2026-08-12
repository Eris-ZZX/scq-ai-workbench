'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type {
  DevelopmentProgressOwner,
  PlatformDevelopmentSetting,
} from '@/lib/platform/development-progress';

type ProgressSettingsResponse = {
  items: PlatformDevelopmentSetting[];
  users: DevelopmentProgressOwner[];
};

export default function PlatformDevelopmentProgressPage() {
  const [items, setItems] = useState<PlatformDevelopmentSetting[]>([]);
  const [users, setUsers] = useState<DevelopmentProgressOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-development-progress', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as ProgressSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '开发进度配置加载失败。');
      setItems((body as ProgressSettingsResponse).items);
      setUsers((body as ProgressSettingsResponse).users);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '开发进度配置加载失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateItem(id: string, patch: Partial<PlatformDevelopmentSetting>) {
    setItems((current) => current.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-development-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            progressPercent: item.progressPercent,
            ownerId: item.ownerId,
            note: item.note,
          })),
        }),
      });
      const body = await response.json().catch(() => null) as ProgressSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '开发进度保存失败。');
      setItems((body as ProgressSettingsResponse).items);
      setUsers((body as ProgressSettingsResponse).users);
      setMessage('开发进度已保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '开发进度保存失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-md border border-border bg-white p-8 text-sm text-muted-foreground">加载开发进度配置...</div>;
  }

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">平台与应用进度</h2>
          <p className="mt-1 text-xs text-muted-foreground">维护用户端开发进度面板中展示的进度百分比、负责人和说明。</p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存配置
        </button>
      </div>

      {error && <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mx-4 mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {item.state === 'active' ? '应用中' : '建设中'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                开发进度（%）
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.progressPercent}
                  onChange={(event) => updateItem(item.id, {
                    progressPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                  })}
                  className="mt-1 h-9 w-full rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                负责人
                <select
                  value={item.ownerId ?? ''}
                  onChange={(event) => updateItem(item.id, { ownerId: event.target.value || null })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">暂不指定</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}（{user.username}）</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              进度说明
              <textarea
                value={item.note}
                maxLength={500}
                onChange={(event) => updateItem(item.id, { note: event.target.value })}
                className="mt-1 min-h-16 w-full resize-y rounded-md border border-border px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="补充当前开发阶段或计划"
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
