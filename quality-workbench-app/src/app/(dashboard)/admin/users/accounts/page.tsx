'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, UserCog, X } from 'lucide-react';

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
type NewUserForm = {
  username: string;
  email: string;
  password: string;
  role: string;
  status: string;
};

const emptyNewUser: NewUserForm = {
  username: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active',
};

export default function AdminUserAccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUser);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
      if (!res.ok) setError('加载用户失败，请刷新后重试。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  }

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
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '创建用户失败。');
      return;
    }
    setShowCreate(false);
    setNewUser(emptyNewUser);
    await load();
  }

  function positionLabel(user: User) {
    return user.positionBinding?.positionRole?.name || '—';
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ws-blue">
              <ArrowLeft className="h-3.5 w-3.5" />用户管理
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <UserCog className="h-4 w-4" />
              Admin / Users / Accounts
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">用户管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              维护账号状态与系统权限。岗位由钉钉登录自动获取，不可手动更改。
            </p>
          </div>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-border bg-white px-3 text-sm transition hover:border-ws-blue hover:text-ws-blue"
            onClick={() => {
              setNewUser(emptyNewUser);
              setShowCreate(true);
            }}
            disabled={saving}
          >
            <Plus className="h-4 w-4" />新增用户
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section>
          {[
            { name: '启用', users: activeUsers },
            { name: '禁用', users: disabledUsers },
          ].map((group) => (
            group.users.length > 0 && (
              <div key={group.name} className="mb-6 overflow-hidden rounded-lg border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">{group.name}</h2>
                  <div className="mt-0.5 text-xs text-muted-foreground">{group.users.length} 人</div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                        <th className="w-2/5 px-3 py-2 text-left">用户</th>
                        <th className="w-[18%] px-3 py-2 text-left">岗位</th>
                        <th className="w-[18%] px-3 py-2 text-left">系统权限</th>
                        <th className="w-[18%] px-3 py-2 text-left">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.users.map((user) => {
                        const isSuperAdmin = user.username === 'admin';
                        return (
                          <tr key={user.id} className="border-b border-border transition hover:bg-muted/20">
                            <td className="px-3 py-3">
                              <div className="text-sm font-medium">{user.username}</div>
                              {user.email && (
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs text-muted-foreground">{positionLabel(user)}</span>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={user.role}
                                onChange={(event) => updateUser(user.id, { role: event.target.value })}
                                disabled={saving || isSuperAdmin}
                                className="h-8 w-full rounded border border-border px-2 text-xs disabled:bg-muted disabled:text-muted-foreground"
                              >
                                <option value="user">用户</option>
                                <option value="manager">业务管理者</option>
                                <option value="admin">管理员</option>
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
            )
          ))}
        </section>
      </div>

      {showCreate && (
        <CreateUserModal
          value={newUser}
          saving={saving}
          onChange={setNewUser}
          onCancel={() => setShowCreate(false)}
          onSubmit={createUser}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  value,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: NewUserForm;
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
              <option value="manager">业务管理者</option>
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

