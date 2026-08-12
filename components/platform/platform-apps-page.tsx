'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type {
  PlatformAppAccess,
  PlatformAppIconKey,
  PlatformAppRecord,
  PlatformAppState,
} from '@/platform/apps/manifest';

type EditableApp = PlatformAppRecord & {
  rowKey: string;
};

type AppSettingsResponse = {
  apps: PlatformAppRecord[];
};

const ICON_OPTIONS: Array<{ value: PlatformAppIconKey; label: string }> = [
  { value: 'boxes', label: '方块' },
  { value: 'clipboard-check', label: '清单' },
  { value: 'flask-conical', label: '实验室' },
  { value: 'folder-kanban', label: '项目' },
  { value: 'gauge', label: '仪表盘' },
  { value: 'library', label: '资源库' },
  { value: 'settings', label: '设置' },
  { value: 'shield-check', label: '盾牌' },
  { value: 'wrench', label: '工具' },
];

function toEditableApp(app: PlatformAppRecord): EditableApp {
  return { ...app, rowKey: app.id };
}

export default function PlatformAppsPage() {
  const [apps, setApps] = useState<EditableApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-apps', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as AppSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '平台应用配置加载失败。');
      setApps((body as AppSettingsResponse).apps.map(toEditableApp));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '平台应用配置加载失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateApp(rowKey: string, patch: Partial<EditableApp>) {
    setApps((current) => current.map((app) => (
      app.rowKey === rowKey ? { ...app, ...patch } : app
    )));
  }

  function addApp() {
    const rowKey = `draft-${Date.now()}-${apps.length}`;
    setApps((current) => [
      ...current,
      {
        rowKey,
        id: '',
        parentId: null,
        href: '/portal/coming-soon/new-app',
        title: '',
        description: '',
        iconKey: 'boxes',
        state: 'coming-soon',
        access: 'authenticated',
        sortOrder: (current.length + 1) * 10,
        builtin: false,
      },
    ]);
  }

  function removeApp(rowKey: string) {
    setApps((current) => current.filter((app) => app.rowKey !== rowKey || app.builtin));
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-apps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apps: apps.map((app) => ({
            id: app.id || undefined,
            parentId: app.parentId,
            href: app.href,
            title: app.title,
            description: app.description,
            iconKey: app.iconKey,
            state: app.state,
            access: app.access,
            sortOrder: app.sortOrder,
          })),
        }),
      });
      const body = await response.json().catch(() => null) as AppSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '平台应用配置保存失败。');
      setApps((body as AppSettingsResponse).apps.map(toEditableApp));
      setMessage('平台应用配置已保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '平台应用配置保存失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-md border border-border bg-white p-8 text-sm text-muted-foreground">加载平台应用配置...</div>;
  }

  const rootApps = apps.filter((app) => !app.parentId);

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">层级应用管理</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            维护门户中的一级应用和一级子应用。应用页面与 API 仍需由代码实现。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addApp}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            新增应用
          </button>
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
      </div>

      {error && <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mx-4 mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      <div className="overflow-x-auto p-4">
        <div className="min-w-[1180px] overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[150px_1.2fr_1.4fr_1.4fr_120px_110px_130px_80px_40px] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>ID</span>
            <span>应用名称</span>
            <span>父应用</span>
            <span>访问地址</span>
            <span>图标</span>
            <span>状态</span>
            <span>访问范围</span>
            <span>排序</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {apps.map((app) => (
              <AppEditRow
                key={app.rowKey}
                app={app}
                rootApps={rootApps}
                saving={saving}
                onChange={updateApp}
                onRemove={removeApp}
              />
            ))}
            {apps.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无平台应用。</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AppEditRow({
  app,
  rootApps,
  saving,
  onChange,
  onRemove,
}: {
  app: EditableApp;
  rootApps: EditableApp[];
  saving: boolean;
  onChange: (rowKey: string, patch: Partial<EditableApp>) => void;
  onRemove: (rowKey: string) => void;
}) {
  return (
    <div className="grid grid-cols-[150px_1.2fr_1.4fr_1.4fr_120px_110px_130px_80px_40px] items-center gap-2 px-3 py-2">
      <input
        value={app.id}
        disabled={app.builtin}
        onChange={(event) => onChange(app.rowKey, { id: event.target.value })}
        className="h-9 rounded-md border border-border px-2 font-mono text-xs text-foreground outline-none focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
        placeholder="sqm-inspection"
      />
      <input
        value={app.title}
        onChange={(event) => onChange(app.rowKey, { title: event.target.value })}
        className="h-9 rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
        placeholder="应用名称"
      />
      <select
        value={app.parentId ?? ''}
        onChange={(event) => onChange(app.rowKey, { parentId: event.target.value || null })}
        className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="">无（一级应用）</option>
        {rootApps
          .filter((candidate) => candidate.rowKey !== app.rowKey)
          .map((candidate) => (
            <option key={candidate.rowKey} value={candidate.id} disabled={!candidate.id}>
              {candidate.title || candidate.id || '未命名应用'}
            </option>
          ))}
      </select>
      <input
        value={app.href}
        onChange={(event) => onChange(app.rowKey, { href: event.target.value })}
        className="h-9 rounded-md border border-border px-2 font-mono text-xs text-foreground outline-none focus:border-primary"
        placeholder="/sqm/inspection"
      />
      <select
        value={app.iconKey}
        onChange={(event) => onChange(app.rowKey, { iconKey: event.target.value as PlatformAppIconKey })}
        className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
      >
        {ICON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <select
        value={app.state}
        onChange={(event) => onChange(app.rowKey, { state: event.target.value as PlatformAppState })}
        className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="active">启用</option>
        <option value="coming-soon">建设中</option>
      </select>
      <select
        value={app.access}
        onChange={(event) => onChange(app.rowKey, { access: event.target.value as PlatformAppAccess })}
        className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="authenticated">登录用户</option>
        <option value="platform-admin">平台管理员</option>
      </select>
      <input
        type="number"
        value={app.sortOrder}
        onChange={(event) => onChange(app.rowKey, { sortOrder: Number(event.target.value) || 0 })}
        className="h-9 rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <button
        type="button"
        aria-label={`删除${app.title || '应用'}`}
        onClick={() => onRemove(app.rowKey)}
        disabled={saving || app.builtin}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <input
        value={app.description}
        onChange={(event) => onChange(app.rowKey, { description: event.target.value })}
        className="col-span-full h-8 rounded-md border border-border px-2 text-xs text-foreground outline-none focus:border-primary"
        placeholder="应用说明"
      />
    </div>
  );
}
