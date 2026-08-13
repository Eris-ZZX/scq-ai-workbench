'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  PlugZap,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  PlatformAppAccess,
  PlatformAppIconKey,
  PlatformAppLaunchMode,
  PlatformAppRecord,
  PlatformAppState,
} from '@/platform/apps/manifest';

type ConnectionView = {
  appId: string;
  displayName: string;
  launchUrl: string;
  note: string;
  enabled: boolean;
  secretConfigured: boolean;
  secretHint: string;
  source: 'database' | 'environment' | 'default';
  updatedAt: string | null;
};

type AdminApp = PlatformAppRecord & {
  connection: ConnectionView | null;
};

type EditableConnection = {
  launchUrl: string;
  note: string;
  enabled: boolean;
  exchangeSecret: string;
  secretConfigured: boolean;
  secretHint: string;
  source: ConnectionView['source'];
  updatedAt: string | null;
};

type EditableApp = Omit<AdminApp, 'connection'> & {
  rowKey: string;
  connection: EditableConnection;
};

type AppSettingsResponse = {
  apps: AdminApp[];
};

type FilterMode = 'all' | PlatformAppLaunchMode;

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

const EMPTY_CONNECTION: EditableConnection = {
  launchUrl: '',
  note: '',
  enabled: false,
  exchangeSecret: '',
  secretConfigured: false,
  secretHint: '',
  source: 'default',
  updatedAt: null,
};

const INPUT_CLASS = 'h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground';
const TEXTAREA_CLASS = 'min-h-20 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground';

function toEditableApp(app: AdminApp): EditableApp {
  return {
    ...app,
    rowKey: app.id,
    connection: app.connection
      ? {
        launchUrl: app.connection.launchUrl,
        note: app.connection.note,
        enabled: app.connection.enabled,
        exchangeSecret: '',
        secretConfigured: app.connection.secretConfigured,
        secretHint: app.connection.secretHint,
        source: app.connection.source,
        updatedAt: app.connection.updatedAt,
      }
      : { ...EMPTY_CONNECTION },
  };
}

function draftApp(rowKey: string, sortOrder: number): EditableApp {
  return {
    rowKey,
    id: '',
    parentId: null,
    href: `/portal/external-apps/new-app-${sortOrder}`,
    title: '',
    description: '',
    iconKey: 'boxes',
    state: 'active',
    access: 'authenticated',
    launchMode: 'external-link',
    sortOrder,
    builtin: false,
    connection: { ...EMPTY_CONNECTION },
  };
}

function modeLabel(mode: PlatformAppLaunchMode) {
  if (mode === 'internal') return '站内应用';
  if (mode === 'external-link') return '外挂纯链接';
  return '外挂 SSO';
}

function statusFor(app: EditableApp) {
  if (app.launchMode === 'internal') {
    return app.state === 'active'
      ? { label: '已启用', tone: 'green' as const }
      : { label: '建设中', tone: 'amber' as const };
  }
  if (app.state !== 'active') return { label: '建设中', tone: 'amber' as const };
  if (!app.connection.launchUrl) return { label: '未配置', tone: 'gray' as const };
  if (!app.connection.enabled) return { label: '已停用', tone: 'gray' as const };
  if (app.launchMode === 'external-sso' && !app.connection.secretConfigured) {
    return { label: '缺少密钥', tone: 'red' as const };
  }
  return { label: '已配置', tone: 'green' as const };
}

function statusClass(tone: ReturnType<typeof statusFor>['tone']) {
  if (tone === 'green') return 'bg-green-50 text-green-700';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700';
  if (tone === 'red') return 'bg-red-50 text-red-700';
  return 'bg-muted text-muted-foreground';
}

function sourceLabel(source: ConnectionView['source']) {
  if (source === 'database') return '数据库配置';
  if (source === 'environment') return '环境变量 fallback';
  return '默认值';
}

export default function PlatformAppsPage({ initialAppId }: { initialAppId?: string }) {
  const [apps, setApps] = useState<EditableApp[]>([]);
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedApp = apps.find((app) => app.rowKey === selectedRowKey) ?? null;
  const rootApps = apps.filter((app) => !app.parentId);
  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return apps.filter((app) => {
      if (filter !== 'all' && app.launchMode !== filter) return false;
      if (!normalizedQuery) return true;
      return [app.id, app.title, app.description]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [apps, filter, query]);

  async function load(preferredRowKey?: string) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-apps', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as AppSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '应用配置加载失败。');
      const nextApps = (body as AppSettingsResponse).apps.map(toEditableApp);
      setApps(nextApps);
      const preferred = preferredRowKey && nextApps.some((app) => app.rowKey === preferredRowKey)
        ? preferredRowKey
        : nextApps[0]?.rowKey ?? '';
      setSelectedRowKey(preferred);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '应用配置加载失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(initialAppId);
  }, [initialAppId]);

  function updateSelected(patch: Partial<EditableApp>) {
    if (!selectedApp) return;
    setApps((current) => current.map((app) => (
      app.rowKey === selectedApp.rowKey ? { ...app, ...patch } : app
    )));
  }

  function updateSelectedConnection(patch: Partial<EditableConnection>) {
    if (!selectedApp) return;
    setApps((current) => current.map((app) => (
      app.rowKey === selectedApp.rowKey
        ? { ...app, connection: { ...app.connection, ...patch } }
        : app
    )));
  }

  function addApp() {
    const rowKey = `draft-${Date.now()}-${apps.length}`;
    setApps((current) => [...current, draftApp(rowKey, (current.length + 1) * 10)]);
    setSelectedRowKey(rowKey);
    setFilter('all');
    setQuery('');
    setMessage('');
    setError('');
  }

  async function saveSelected() {
    if (!selectedApp) return;
    const appId = selectedApp.id.trim();
    if (!appId) {
      setError('请先填写应用 ID。');
      return;
    }
    if (!selectedApp.title.trim()) {
      setError('请先填写应用名称。');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const appPayload = {
        id: appId,
        parentId: selectedApp.parentId,
        href: selectedApp.launchMode === 'internal'
          ? selectedApp.href
          : `/portal/external-apps/${appId}`,
        title: selectedApp.title,
        description: selectedApp.description,
        iconKey: selectedApp.iconKey,
        state: selectedApp.state,
        access: selectedApp.access,
        launchMode: selectedApp.launchMode,
        sortOrder: selectedApp.sortOrder,
      };
      const connection = selectedApp.launchMode === 'internal'
        ? null
        : {
          launchUrl: selectedApp.connection.launchUrl,
          note: selectedApp.connection.note,
          exchangeSecret: selectedApp.connection.exchangeSecret,
          enabled: selectedApp.connection.enabled,
        };
      const response = await fetch(`/api/admin/platform-apps/${encodeURIComponent(appId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appPayload, connection }),
      });
      const body = await response.json().catch(() => null) as AppSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '应用配置保存失败。');
      const nextApps = (body as AppSettingsResponse).apps.map(toEditableApp);
      setApps(nextApps);
      setSelectedRowKey(appId);
      setMessage('应用配置已保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '应用配置保存失败。');
    } finally {
      setSaving(false);
    }
  }

  async function testSelectedConnection() {
    if (!selectedApp || !selectedApp.id) return;
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/platform-apps/${encodeURIComponent(selectedApp.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-connection' }),
      });
      const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!response.ok) throw new Error(body?.error || '外挂应用连接测试失败。');
      setMessage(body?.message || '外挂应用连接测试通过。');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '外挂应用连接测试失败。');
    } finally {
      setTesting(false);
    }
  }

  async function deleteSelected() {
    if (!selectedApp || selectedApp.builtin) return;
    if (!selectedApp.id) {
      setApps((current) => current.filter((app) => app.rowKey !== selectedApp.rowKey));
      setSelectedRowKey(apps.find((app) => app.rowKey !== selectedApp.rowKey)?.rowKey ?? '');
      return;
    }
    if (!window.confirm(`确定删除“${selectedApp.title || selectedApp.id}”吗？连接配置也会被删除。`)) return;

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/platform-apps/${encodeURIComponent(selectedApp.id)}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => null) as AppSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '应用删除失败。');
      const nextApps = (body as AppSettingsResponse).apps.map(toEditableApp);
      setApps(nextApps);
      setSelectedRowKey(nextApps[0]?.rowKey ?? '');
      setMessage('应用及其连接配置已删除。');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '应用删除失败。');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-md border border-border bg-white p-8 text-sm text-muted-foreground">
        加载应用管理配置...
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Application / Registry
          </div>
          <h2 className="mt-1 text-lg font-semibold text-foreground">应用管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            统一维护站内应用、外挂链接、SSO 入口和访问范围。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load(selectedRowKey)}
            disabled={saving || testing || deleting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            type="button"
            onClick={addApp}
            disabled={saving || testing || deleting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            新增应用
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 sm:mx-5">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[minmax(250px,0.78fr)_minmax(0,1.5fr)]">
        <aside className="border-b border-border p-4 lg:border-b-0 lg:border-r sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${INPUT_CLASS} pl-9`}
              placeholder="搜索应用名称、ID"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ['all', '全部'],
              ['internal', '站内'],
              ['external-link', '纯链接'],
              ['external-sso', 'SSO'],
            ] as Array<[FilterMode, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={filter === value
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary'}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {filteredApps.map((app) => {
              const status = statusFor(app);
              return (
                <button
                  key={app.rowKey}
                  type="button"
                  onClick={() => setSelectedRowKey(app.rowKey)}
                  className={selectedRowKey === app.rowKey
                    ? 'w-full rounded-md border border-primary bg-primary/5 p-3 text-left'
                    : 'w-full rounded-md border border-border bg-white p-3 text-left transition hover:border-primary/60'}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {app.title || '未命名应用'}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {app.id || '待填写 ID'}
                      </div>
                    </div>
                    {app.builtin && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        内置
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{modeLabel(app.launchMode)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(status.tone)}`}>
                      {status.label}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredApps.length === 0 && (
              <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                没有匹配的应用。
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-5">
          {selectedApp ? (
            <AppEditor
              app={selectedApp}
              rootApps={rootApps}
              saving={saving}
              testing={testing}
              deleting={deleting}
              onChange={updateSelected}
              onConnectionChange={updateSelectedConnection}
              onSave={() => void saveSelected()}
              onTest={() => void testSelectedConnection()}
              onDelete={() => void deleteSelected()}
            />
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              请选择应用，或新增一个外挂应用。
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function AppEditor({
  app,
  rootApps,
  saving,
  testing,
  deleting,
  onChange,
  onConnectionChange,
  onSave,
  onTest,
  onDelete,
}: {
  app: EditableApp;
  rootApps: EditableApp[];
  saving: boolean;
  testing: boolean;
  deleting: boolean;
  onChange: (patch: Partial<EditableApp>) => void;
  onConnectionChange: (patch: Partial<EditableConnection>) => void;
  onSave: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const status = statusFor(app);
  const disabled = saving || testing || deleting;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              {app.launchMode === 'internal'
                ? <Settings2 className="h-4 w-4" />
                : app.launchMode === 'external-sso'
                  ? <ShieldCheck className="h-4 w-4" />
                  : <Link2 className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">
                {app.title || '新增应用'}
              </h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {app.id || '未填写 ID'}
              </p>
            </div>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(status.tone)}`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-6 pt-5">
        <section>
          <SectionTitle title="基础信息" description="定义门户展示名称、说明和图标。" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">应用 ID</span>
              <input
                value={app.id}
                disabled={app.builtin || disabled}
                onChange={(event) => onChange({ id: event.target.value })}
                className={`${INPUT_CLASS} font-mono text-xs`}
                placeholder="quality-dashboard"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">应用名称</span>
              <input
                value={app.title}
                disabled={disabled}
                onChange={(event) => onChange({ title: event.target.value })}
                className={INPUT_CLASS}
                placeholder="质量看板"
              />
            </label>
          </div>
          <label className="mt-3 block space-y-1.5">
            <span className="text-xs font-medium text-foreground">应用说明</span>
            <textarea
              value={app.description}
              disabled={disabled}
              onChange={(event) => onChange({ description: event.target.value })}
              className={TEXTAREA_CLASS}
              placeholder="说明该应用面向的业务场景。"
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">图标</span>
              <select
                value={app.iconKey}
                disabled={disabled}
                onChange={(event) => onChange({ iconKey: event.target.value as PlatformAppIconKey })}
                className={INPUT_CLASS}
              >
                {ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">父应用</span>
              <select
                value={app.parentId ?? ''}
                disabled={disabled}
                onChange={(event) => onChange({ parentId: event.target.value || null })}
                className={INPUT_CLASS}
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
            </label>
          </div>
        </section>

        <section>
          <SectionTitle title="层级与权限" description="控制应用状态、访问范围和展示顺序。" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">应用状态</span>
              <select
                value={app.state}
                disabled={disabled}
                onChange={(event) => onChange({ state: event.target.value as PlatformAppState })}
                className={INPUT_CLASS}
              >
                <option value="active">启用</option>
                <option value="coming-soon">建设中</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">访问范围</span>
              <select
                value={app.access}
                disabled={disabled}
                onChange={(event) => onChange({ access: event.target.value as PlatformAppAccess })}
                className={INPUT_CLASS}
              >
                <option value="authenticated">登录用户</option>
                <option value="platform-admin">平台管理员</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">排序</span>
              <input
                type="number"
                value={app.sortOrder}
                disabled={disabled}
                onChange={(event) => onChange({ sortOrder: Number(event.target.value) || 0 })}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        </section>

        <section>
          <SectionTitle title="启动方式" description="决定用户点击门户应用后如何进入目标应用。" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([
              ['internal', '站内应用', '使用工作台内部路径'],
              ['external-link', '纯链接', '新标签页直接打开'],
              ['external-sso', 'SSO', '通过一次性 code 登录'],
            ] as Array<[PlatformAppLaunchMode, string, string]>).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ launchMode: value })}
                className={app.launchMode === value
                  ? 'rounded-md border border-primary bg-primary/5 p-3 text-left'
                  : 'rounded-md border border-border p-3 text-left transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60'}
              >
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
              </button>
            ))}
          </div>
          <label className="mt-3 block space-y-1.5">
            <span className="text-xs font-medium text-foreground">
              {app.launchMode === 'internal' ? '站内入口路径' : '系统内部 launcher 路径'}
            </span>
            <input
              value={app.launchMode === 'internal' ? app.href : `/portal/external-apps/${app.id || 'new-app'}`}
              disabled
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
            <span className="block text-[11px] leading-5 text-muted-foreground">
              {app.launchMode === 'internal'
                ? '必须是以 / 开头的工作台内部路径。'
                : '外挂应用的真实地址在下方连接配置中维护。'}
            </span>
          </label>
        </section>

        {app.launchMode !== 'internal' && (
          <section className="rounded-md border border-border bg-muted/20 p-4">
            <SectionTitle
              title="外挂连接"
              description={app.launchMode === 'external-sso'
                ? 'SSO 应用使用独立兑换密钥，不会共享工作台 qe-session。'
                : '纯链接应用只保存安全的外部地址，并在门户新标签页打开。'}
            />
            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-medium text-foreground">外挂应用地址</span>
              <input
                value={app.connection.launchUrl}
                disabled={disabled}
                onChange={(event) => onConnectionChange({ launchUrl: event.target.value })}
                className={`${INPUT_CLASS} font-mono text-xs`}
                placeholder="https://external.example.com"
              />
              <span className="block text-[11px] leading-5 text-muted-foreground">
                只允许 http/https，不能包含账号、密码、查询参数或片段。
              </span>
            </label>
            {app.launchMode === 'external-sso' && (
              <label className="mt-3 block space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  SSO 兑换密钥
                </span>
                <input
                  type="password"
                  value={app.connection.exchangeSecret}
                  disabled={disabled}
                  onChange={(event) => onConnectionChange({ exchangeSecret: event.target.value })}
                  className={`${INPUT_CLASS} font-mono text-xs`}
                  placeholder={app.connection.secretConfigured ? app.connection.secretHint : '输入独立随机密钥'}
                  autoComplete="new-password"
                />
                <span className="block text-[11px] leading-5 text-muted-foreground">
                  已配置密钥不会回显；留空保存会保留原密钥。当前来源：{sourceLabel(app.connection.source)}。
                </span>
              </label>
            )}
            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-medium text-foreground">管理员备注</span>
              <textarea
                value={app.connection.note}
                disabled={disabled}
                onChange={(event) => onConnectionChange({ note: event.target.value })}
                className={TEXTAREA_CLASS}
                placeholder="部署环境、负责人或切换说明。"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={app.connection.enabled}
                  disabled={disabled}
                  onChange={(event) => onConnectionChange({ enabled: event.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                允许用户进入
              </label>
              <button
                type="button"
                onClick={onTest}
                disabled={disabled || !app.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                测试连接
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || app.builtin}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          删除应用
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存当前应用
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
