'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, RefreshCw, Search, UserRound } from 'lucide-react';

type Position = { id: string; name: string; roleName?: string | null };
type Organization = { id: string; name: string; parentId: string | null };

type PlatformUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  platformRole: string;
  workbenchRole: string;
  status: string;
  source: string;
  externalSource: string | null;
  dingtalkUserId: string | null;
  syncAt: string | null;
  unionid: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
  emailVerified: boolean | null;
  address: string | null;
  birthdate: string | null;
  gender: string | null;
  locale: string | null;
  nickname: string | null;
  preferredUsername: string | null;
  profile: string | null;
  website: string | null;
  zoneinfo: string | null;
  externalIdAuthing: string | null;
  extendedFields: string | null;
  tenantId: string | null;
  userpoolId: string | null;
  roles: string | null;
  position: { id: string; positionRoleId: string; positionRole: Position } | null;
  supervisor: { directoryUserId: string | null; name: string | null };
  organization: Organization | null;
  aiResourceRole: string | null;
  projectCount: number;
};

type PlatformData = {
  users: PlatformUser[];
  safeguards: {
    activePlatformAdminCount: number;
    activeWorkbenchAdminCount: number;
    activeAiResourceAdminCount: number;
  };
};

const emptyCreate = {
  username: '',
  password: '',
  email: '',
  platformRole: 'user',
  workbenchRole: 'user',
  status: 'active',
};

function sourceLabel(source: string) {
  if (source === 'authing') return 'Authing';
  if (source === 'dws') return 'DWS';
  if (source === 'dingtalk') return '钉钉（历史）';
  return '本地';
}

export default function PlatformUsersPage() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [platformRoleFilter, setPlatformRoleFilter] = useState('');
  const [workbenchRoleFilter, setWorkbenchRoleFilter] = useState('');
  const [aiResourceRoleFilter, setAiResourceRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);

  const visibleUsers = useMemo(
    () => (data?.users ?? []).filter((user) => (
      (!statusFilter || user.status === statusFilter) &&
      (!sourceFilter || user.source === sourceFilter) &&
      (!platformRoleFilter || user.platformRole === platformRoleFilter) &&
      (!workbenchRoleFilter || user.workbenchRole === workbenchRoleFilter) &&
      (!aiResourceRoleFilter || (user.aiResourceRole ?? 'user') === aiResourceRoleFilter)
    )),
    [aiResourceRoleFilter, data, platformRoleFilter, sourceFilter, statusFilter, workbenchRoleFilter],
  );

  const selectedUser = useMemo(
    () => visibleUsers.find((user) => user.id === selectedId) ?? visibleUsers[0] ?? null,
    [selectedId, visibleUsers],
  );

  async function load(nextQuery = query) {
    setLoading(true);
    setError('');
    try {
      const params = nextQuery.trim() ? `?q=${encodeURIComponent(nextQuery.trim())}` : '';
      const response = await fetch(`/api/admin/platform-users${params}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? '加载用户失败。');
        return;
      }
      const next = payload as PlatformData;
      setData(next);
      setSelectedId((current) => (
        next.users.some((user) => user.id === current) ? current : next.users[0]?.id ?? ''
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updatePermission(action: string, payload: Record<string, unknown>) {
    if (!selectedUser) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, action, ...payload }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? '权限更新失败。');
        return;
      }
      setMessage('权限已更新。');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '权限更新失败。');
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? '创建用户失败。');
        return;
      }
      setCreateForm(emptyCreate);
      setShowCreate(false);
      setMessage('用户已创建。');
      await load();
      setSelectedId(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建用户失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="rounded-lg border border-border bg-white p-8 text-sm text-muted-foreground">加载用户与权限...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">平台用户</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {visibleUsers.length} / {data?.users.length ?? 0} 个用户 · 平台管理员 {data?.safeguards.activePlatformAdminCount ?? 0} · 工作台管理员 {data?.safeguards.activeWorkbenchAdminCount ?? 0} · AI 管理员 {data?.safeguards.activeAiResourceAdminCount ?? 0}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form
              className="flex h-9 items-center rounded border border-border bg-white"
              onSubmit={(event) => {
                event.preventDefault();
                void load();
              }}
            >
              <Search className="ml-2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索用户名或邮箱"
                className="h-full w-48 bg-transparent px-2 text-sm outline-none"
              />
            </form>
            <select className="h-9 rounded border border-border bg-white px-2 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="disabled">禁用</option>
            </select>
            <select className="h-9 rounded border border-border bg-white px-2 text-xs" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="">全部来源</option>
              <option value="local">本地</option>
              <option value="authing">Authing</option>
              <option value="dws">DWS</option>
              <option value="dingtalk">钉钉（历史）</option>
            </select>
            <select className="h-9 rounded border border-border bg-white px-2 text-xs" value={platformRoleFilter} onChange={(event) => setPlatformRoleFilter(event.target.value)}>
              <option value="">全部平台角色</option>
              <option value="user">用户</option>
              <option value="admin">平台管理员</option>
            </select>
            <select className="h-9 rounded border border-border bg-white px-2 text-xs" value={workbenchRoleFilter} onChange={(event) => setWorkbenchRoleFilter(event.target.value)}>
              <option value="">全部工作台角色</option>
              <option value="user">用户</option>
              <option value="manager">项目管理者</option>
              <option value="admin">应用管理员</option>
            </select>
            <select className="h-9 rounded border border-border bg-white px-2 text-xs" value={aiResourceRoleFilter} onChange={(event) => setAiResourceRoleFilter(event.target.value)}>
              <option value="">全部 AI 角色</option>
              <option value="user">用户</option>
              <option value="reviewer">审批人</option>
              <option value="admin">管理员</option>
            </select>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded border border-border bg-white px-3 text-sm hover:border-primary disabled:opacity-50"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              onClick={() => setShowCreate((current) => !current)}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              新建本地用户
            </button>
          </div>
        </div>
        {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}
      </section>

      {showCreate ? (
        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">新建本地用户</h2>
          <div className="grid gap-3 md:grid-cols-7">
            <input className="h-9 rounded border border-border px-2 text-sm" placeholder="用户名" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} />
            <input className="h-9 rounded border border-border px-2 text-sm" placeholder="初始密码" type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
            <input className="h-9 rounded border border-border px-2 text-sm" placeholder="邮箱（可选）" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
            <select className="h-9 rounded border border-border px-2 text-sm" value={createForm.platformRole} onChange={(event) => setCreateForm({ ...createForm, platformRole: event.target.value })}>
              <option value="user">用户</option>
              <option value="admin">平台管理员</option>
            </select>
            <select className="h-9 rounded border border-border px-2 text-sm" value={createForm.workbenchRole} onChange={(event) => setCreateForm({ ...createForm, workbenchRole: event.target.value })}>
              <option value="user">用户</option>
              <option value="manager">项目管理者</option>
              <option value="admin">应用管理员</option>
            </select>
            <button type="button" className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={() => void createUser()} disabled={saving}>
              保存用户
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">用户列表</div>
          <div className="max-h-[48rem] overflow-auto">
            {visibleUsers.map((user) => (
              <button
                type="button"
                key={user.id}
                className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/30 ${selectedUser?.id === user.id ? 'bg-primary/5' : ''}`}
                onClick={() => setSelectedId(user.id)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{user.username}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email || '未填写邮箱'}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      平台：{user.platformRole === 'admin' ? '管理员' : '用户'}
                      {' · '}
                      AI {user.aiResourceRole === 'admin' ? '管理员' : user.aiResourceRole === 'reviewer' ? '审批人' : '用户'}
                      {' · '}
                      工作台：{user.workbenchRole === 'admin' ? '应用管理员' : user.workbenchRole === 'manager' ? '项目管理者' : '用户'}
                      {' · '}
                      组织：{user.organization?.name || '未同步组织'}
                      {' · '}
                      {user.position?.positionRole.name || '未绑定岗位'}
                      {' · '}
                      {user.projectCount} 个项目
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block">{sourceLabel(user.source)}</span>
                  <span className={user.status === 'active' ? 'text-green-700' : 'text-red-700'}>
                    {user.status === 'active' ? '启用' : '禁用'}
                  </span>
                </span>
              </button>
            ))}
            {visibleUsers.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">没有匹配的用户</div> : null}
          </div>
        </section>

        {selectedUser && data ? (
          <section className="space-y-4">
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedUser.username}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sourceLabel(selectedUser.source)} · {selectedUser.email || '未填写邮箱'}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs ${selectedUser.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {selectedUser.status === 'active' ? '启用' : '禁用'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded border border-border bg-muted/20 p-3">
                  <div className="mb-2 text-sm font-semibold text-foreground">组织属性</div>
                  <div className="flex gap-3 overflow-x-auto">
                    <ReadOnlyField label="组织小组（目录同步）">
                      {selectedUser.organization?.name || '未同步组织'}
                    </ReadOnlyField>
                    <ReadOnlyField label="岗位（目录同步）">
                      {selectedUser.position?.positionRole.name || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="直接上级（目录同步）">
                      {selectedUser.supervisor.name || selectedUser.supervisor.directoryUserId || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="unionid">
                      {selectedUser.unionid || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="phone_number">
                      {selectedUser.phoneNumber || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="phone_number_verified">
                      {selectedUser.phoneNumberVerified === null || selectedUser.phoneNumberVerified === undefined ? '尚未获取' : String(selectedUser.phoneNumberVerified)}
                    </ReadOnlyField>
                    <ReadOnlyField label="email_verified">
                      {selectedUser.emailVerified === null || selectedUser.emailVerified === undefined ? '尚未获取' : String(selectedUser.emailVerified)}
                    </ReadOnlyField>
                    <ReadOnlyField label="address">
                      {selectedUser.address || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="birthdate">
                      {selectedUser.birthdate || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="gender">
                      {selectedUser.gender || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="locale">
                      {selectedUser.locale || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="nickname">
                      {selectedUser.nickname || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="preferred_username">
                      {selectedUser.preferredUsername || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="profile">
                      {selectedUser.profile || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="website">
                      {selectedUser.website || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="zoneinfo">
                      {selectedUser.zoneinfo || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="external_id">
                      {selectedUser.externalIdAuthing || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="extended_fields">
                      {selectedUser.extendedFields || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="tenant_id">
                      {selectedUser.tenantId || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="userpool_id">
                      {selectedUser.userpoolId || '尚未获取'}
                    </ReadOnlyField>
                    <ReadOnlyField label="roles">
                      {selectedUser.roles || '尚未获取'}
                    </ReadOnlyField>
                  </div>
                </div>
                <PermissionCard title="平台角色" description="控制整个质量平台的全局管理权限。">
                  <PermissionField label="平台角色">
                    <select className="h-9 w-full rounded border border-border px-2 text-sm" value={selectedUser.platformRole} disabled={saving} onChange={(event) => void updatePermission('platform', { platformRole: event.target.value })}>
                      <option value="user">用户</option>
                      <option value="admin">平台管理员</option>
                    </select>
                  </PermissionField>
                  <PermissionField label="账号状态">
                    <select className="h-9 w-full rounded border border-border px-2 text-sm" value={selectedUser.status} disabled={saving} onChange={(event) => void updatePermission('platform', { status: event.target.value })}>
                      <option value="active">启用</option>
                      <option value="disabled">禁用</option>
                    </select>
                  </PermissionField>
                </PermissionCard>
                <PermissionCard title="AI 资源库角色" description="只控制 AI 资源库内的成员、审批和资源管理权限。">
                  <PermissionField label="应用角色">
                    <select className="h-9 w-full rounded border border-border px-2 text-sm" value={selectedUser.aiResourceRole ?? 'user'} disabled={saving} onChange={(event) => void updatePermission('ai-resource-role', { role: event.target.value })}>
                      <option value="user">用户</option>
                      <option value="reviewer">审批人</option>
                      <option value="admin">应用管理员</option>
                    </select>
                  </PermissionField>
                </PermissionCard>
                <PermissionCard title="质量工作台角色" description="只控制质量工作台的应用级项目管理能力。">
                  <PermissionField label="应用角色">
                    <select className="h-9 w-full rounded border border-border px-2 text-sm" value={selectedUser.workbenchRole} disabled={saving} onChange={(event) => void updatePermission('workbench-role', { role: event.target.value })}>
                      <option value="user">用户</option>
                      <option value="manager">项目管理者</option>
                      <option value="admin">应用管理员</option>
                    </select>
                  </PermissionField>
                </PermissionCard>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-muted-foreground">请选择用户</div>
        )}
      </div>
    </div>
  );
}

function PermissionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PermissionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full rounded border border-border p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{description}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-[220px] flex-1">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center rounded border border-border bg-white px-2 text-sm text-foreground">
        {children}
      </div>
    </div>
  );
}
