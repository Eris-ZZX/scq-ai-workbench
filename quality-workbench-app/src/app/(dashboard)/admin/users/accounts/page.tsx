'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, UserCog, X } from 'lucide-react';

type Role = {
  id: string;
  name: string;
  isActive: boolean;
};

type User = {
  id: string;
  username: string;
  role: string;
  status: string;
  email: string | null;
  positionBinding: null | {
    positionRoleId: string;
    positionRole: { id: string; name: string };
  };
};

type UserGroup = {
  id: string;
  name: string;
  users: User[];
};

type NewUserForm = {
  username: string;
  email: string;
  password: string;
  role: string;
  status: string;
  positionRoleId: string;
};

const emptyNewUser: NewUserForm = {
  username: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active',
  positionRoleId: '',
};

export default function AdminUserAccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUser);

  async function load() {
    setError('');
    try {
    const [usersRes, rolesRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/positions'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    if (!usersRes.ok || !rolesRes.ok) setError('加载用户或角色失败，请刷新后重试。');
    setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户或角色失败');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const activeUsers = useMemo(() => users.filter((user) => user.status === 'active'), [users]);
  const disabledUsers = useMemo(() => users.filter((user) => user.status === 'disabled'), [users]);

  async function updateUser(id: string, data: Record<string, string | null>) {
    setError('');
    setSaving(true);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '更新用户失败。');
      return;
    }
    setError('');
    await load();
  }

  async function createUser() {
    setError('');
    const username = newUser.username.trim();
    const password = newUser.password;
    if (!username || !password) {
      setError('请填写用户名和密码。');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) {
      setError('用户名须为 1-50 位字母、数字、下划线或连字符。');
      return;
    }
    if (password.length < 6 || password.length > 128) {
      setError('密码长度应为 6-128 位。');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: newUser.email.trim() || null,
        password,
        role: newUser.role,
        status: newUser.status,
        positionRoleId: newUser.positionRoleId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '创建用户失败。');
      return;
    }
    setError('');
    setNewUser(emptyNewUser);
    setShowCreate(false);
    await load();
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ws-blue">
              <ArrowLeft className="h-3.5 w-3.5" />
              用户管理
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <UserCog className="h-4 w-4" />
              Admin / User Accounts
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">用户管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">按启用状态分列表，并在列表内按角色分类维护用户。</p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-1 rounded border border-ws-blue bg-ws-blue px-3 text-sm font-medium text-white hover:bg-ws-blue/90"
            onClick={() => {
              setError('');
              setNewUser(emptyNewUser);
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4" />
            新增用户
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <UserStatusList
            title="启用用户"
            users={activeUsers}
            roles={roles}
            saving={saving}
            updateUser={updateUser}
          />
          <UserStatusList
            title="禁用用户"
            users={disabledUsers}
            roles={roles}
            saving={saving}
            updateUser={updateUser}
          />
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          value={newUser}
          roles={roles}
          saving={saving}
          onChange={setNewUser}
          onCancel={() => setShowCreate(false)}
          onSubmit={createUser}
        />
      )}
    </div>
  );
}

function groupUsersByRole(users: User[], roles: Role[]): UserGroup[] {
  const groups = roles
    .map((role) => ({
      id: role.id,
      name: role.name,
      users: users.filter((user) => user.positionBinding?.positionRoleId === role.id),
    }))
    .filter((group) => group.users.length > 0);
  const unassigned = users.filter((user) => !user.positionBinding);
  if (unassigned.length > 0) groups.push({ id: 'unassigned', name: '未分配角色', users: unassigned });
  return groups;
}

function UserStatusList({
  title,
  users,
  roles,
  saving,
  updateUser,
}: {
  title: string;
  users: User[];
  roles: Role[];
  saving: boolean;
  updateUser: (id: string, data: Record<string, string | null>) => Promise<void>;
}) {
  const groups = groupUsersByRole(users, roles);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">当前 {users.length} 个用户</p>
      </div>

      {groups.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">暂无用户</div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="border-b border-border last:border-b-0">
            <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-muted-foreground">
              {group.name} · {group.users.length}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
                  <col className="w-[30%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">用户</th>
                    <th className="px-3 py-2">系统权限</th>
                    <th className="px-3 py-2">角色</th>
                    <th className="px-3 py-2">账号状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {group.users.map((user) => {
                    const isSuperAdmin = user.username === 'admin';
                    return (
                      <tr key={user.id}>
                        <td className="px-3 py-3">
                          <div className="truncate font-medium text-foreground">{user.username}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {user.email ?? '-'}
                            {isSuperAdmin ? ' / 超级管理账号' : ''}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.role}
                            onChange={(event) => updateUser(user.id, { role: event.target.value })}
                            disabled={saving || isSuperAdmin}
                            className="h-8 w-full max-w-36 rounded border border-border px-2 text-xs disabled:bg-muted disabled:text-muted-foreground"
                          >
                            <option value="user">用户</option>
                            <option value="admin">管理员</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.positionBinding?.positionRoleId ?? ''}
                            onChange={(event) => updateUser(user.id, { positionRoleId: event.target.value || null })}
                            disabled={saving}
                            className="h-8 w-full rounded border border-border px-2 text-xs"
                          >
                            <option value="">未分配角色</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id} disabled={!role.isActive}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.status}
                            onChange={(event) => updateUser(user.id, { status: event.target.value })}
                            disabled={saving || isSuperAdmin}
                            className="h-8 w-full max-w-36 rounded border border-border px-2 text-xs disabled:bg-muted disabled:text-muted-foreground"
                          >
                            <option value="active">启用</option>
                            <option value="disabled">禁用</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function CreateUserModal({
  value,
  roles,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: NewUserForm;
  roles: Role[];
  saving: boolean;
  onChange: (value: NewUserForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const requiredMissing = !value.username.trim() || !value.password.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">新增用户</h2>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onCancel} title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">用户名</span>
            <input
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.username}
              onChange={(event) => onChange({ ...value, username: event.target.value })}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">邮箱</span>
            <input
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.email}
              onChange={(event) => onChange({ ...value, email: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">初始密码</span>
            <input
              type="password"
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.password}
              onChange={(event) => onChange({ ...value, password: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">系统权限</span>
            <select
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.role}
              onChange={(event) => onChange({ ...value, role: event.target.value })}
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">账号状态</span>
            <select
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.status}
              onChange={(event) => onChange({ ...value, status: event.target.value })}
            >
              <option value="active">启用</option>
              <option value="disabled">禁用</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">角色</span>
            <select
              className="h-9 w-full rounded border border-border px-2 text-sm"
              value={value.positionRoleId}
              onChange={(event) => onChange({ ...value, positionRoleId: event.target.value })}
            >
              <option value="">未分配角色</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id} disabled={!role.isActive}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button className="h-9 rounded border border-border bg-white px-3 text-sm hover:border-ws-blue" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button
            className="h-9 rounded bg-ws-blue px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSubmit}
            disabled={saving || requiredMissing}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
