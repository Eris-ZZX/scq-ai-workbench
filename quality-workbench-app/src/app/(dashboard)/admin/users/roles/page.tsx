'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

type Position = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder?: number;
  _count?: { userPositions: number };
};

function actionButton(danger = false) {
  return `inline-flex h-8 items-center gap-1 rounded border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
    danger
      ? 'border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50'
      : 'border-border bg-white text-foreground hover:border-ws-blue hover:text-ws-blue'
  }`;
}

export default function AdminRoleManagementPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roleName, setRoleName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');

  async function load() {
    setError('');
    try {
    const res = await fetch('/api/admin/positions');
    if (res.ok) setPositions(await res.json());
    if (!res.ok) setError('加载角色失败，请刷新后重试。');
    setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载角色失败');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function createPosition() {
    const name = roleName.trim();
    if (!name) return;
    setSaving(true);
    const res = await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '创建角色失败。');
      return;
    }
    setRoleName('');
    load();
  }

  async function updatePosition(id: string, name: string, currentName: string) {
    const nextName = name.trim();
    if (!nextName) return;
    if (nextName === currentName) {
      cancelEditing();
      return;
    }

    setSaving(true);
    const res = await fetch('/api/admin/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: nextName }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '更新角色失败。');
      return;
    }
    cancelEditing();
    load();
  }

  async function deletePosition(position: Position) {
    if (!window.confirm(`删除角色“${position.name}”？`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/positions?id=${encodeURIComponent(position.id)}`, {
      method: 'DELETE',
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '删除角色失败。');
      return;
    }
    load();
  }

  function startEditing(position: Position) {
    setError('');
    setEditingId(position.id);
    setEditingName(position.name);
  }

  function cancelEditing() {
    setEditingId('');
    setEditingName('');
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ws-blue">
              <ArrowLeft className="h-3.5 w-3.5" />
              用户管理
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Admin / Roles
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">角色管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">维护可分配给用户和项目的岗位角色名称。</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">角色列表</h2>
          </div>

          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(0,1fr)_88px]">
            <input
              className="h-9 rounded border border-border px-2 text-sm"
              placeholder="角色名称"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
            />
            <button className={actionButton()} onClick={createPosition} disabled={saving || !roleName.trim()} title="新增角色">
              <Plus className="h-4 w-4" />新增
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">名称</th>
                  <th className="w-28 px-3 py-2">用户数量</th>
                  <th className="w-44 px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {positions.map((position) => {
                  const editing = editingId === position.id;
                  return (
                    <tr key={position.id}>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input
                            className="h-8 w-full rounded border border-border px-2"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-foreground">{position.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-foreground">
                        {position._count?.userPositions ?? 0}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <div className="flex gap-2">
                            <button
                              className={actionButton()}
                              onClick={() => updatePosition(position.id, editingName, position.name)}
                              disabled={saving || !editingName.trim()}
                              title="保存角色名称"
                            >
                              <Save className="h-4 w-4" />保存
                            </button>
                            <button
                              className={actionButton()}
                              onClick={cancelEditing}
                              disabled={saving}
                              title="取消编辑"
                            >
                              <X className="h-4 w-4" />取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              className={actionButton()}
                              onClick={() => startEditing(position)}
                              disabled={saving}
                              title="编辑角色名称"
                            >
                              <Pencil className="h-4 w-4" />编辑
                            </button>
                            <button
                              className={actionButton(true)}
                              onClick={() => deletePosition(position)}
                              disabled={saving}
                              title="删除角色"
                            >
                              <Trash2 className="h-4 w-4" />删除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
