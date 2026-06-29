'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';

type Position = {
  id: string;
  name: string;
  roleName: string | null;
  isActive: boolean;
  sortOrder?: number;
  _count?: { userPositions: number };
};

function displayRoleName(position: Position) {
  return position.roleName?.trim() || position.name;
}

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
  const [groupName, setGroupName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState('');
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingRoleName, setEditingRoleName] = useState('');

  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || displayRoleName(a).localeCompare(displayRoleName(b), 'zh-CN')),
    [positions],
  );

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/admin/positions');
      if (!res.ok) {
        setError('加载分组/角色失败，请刷新后重试。');
        return;
      }
      const data: Position[] = await res.json();
      setPositions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分组/角色失败');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function createPosition() {
    const nextGroupName = groupName.trim();
    const nextRoleName = roleName.trim();
    if (!nextGroupName || !nextRoleName) return;

    setSaving(true);
    const res = await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupName: nextGroupName, roleName: nextRoleName }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '创建角色失败。');
      return;
    }
    setGroupName('');
    setRoleName('');
    load();
  }

  async function updatePosition(position: Position) {
    const nextGroupName = editingGroupName.trim();
    const nextRoleName = editingRoleName.trim();
    if (!nextGroupName || !nextRoleName) return;
    if (nextGroupName === position.name && nextRoleName === displayRoleName(position)) {
      cancelRoleEditing();
      return;
    }

    setSaving(true);
    const res = await fetch('/api/admin/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: position.id, groupName: nextGroupName, roleName: nextRoleName }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '更新角色失败。');
      return;
    }
    cancelRoleEditing();
    load();
  }

  async function deletePosition(position: Position) {
    if (!window.confirm(`删除角色“${position.name} / ${displayRoleName(position)}”？`)) return;
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

  function startRoleEditing(position: Position) {
    setError('');
    setEditingRoleId(position.id);
    setEditingGroupName(position.name);
    setEditingRoleName(displayRoleName(position));
  }

  function cancelRoleEditing() {
    setEditingRoleId('');
    setEditingGroupName('');
    setEditingRoleName('');
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ws-blue">
              <ArrowLeft className="h-3.5 w-3.5" />
              用户管理
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Admin / Role Groups
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">分组与角色管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">分组用于岗位池和项目隔离，角色用于用户实际绑定。</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">新增角色</h2>
            <div className="text-xs text-muted-foreground">{positions.length} 个角色</div>
          </div>

          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]">
            <input
              className="h-9 rounded border border-border px-2 text-sm"
              placeholder="分组名称"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <input
              className="h-9 rounded border border-border px-2 text-sm"
              placeholder="角色名称"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
            />
            <button className={actionButton()} onClick={createPosition} disabled={saving || !groupName.trim() || !roleName.trim()} title="新增角色">
              <Plus className="h-4 w-4" />新增
            </button>
          </div>

          {sortedPositions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">暂无角色</div>
          ) : (
            <div className="divide-y divide-border">
              {sortedPositions.map((position) => {
                const editingRole = editingRoleId === position.id;
                return (
                  <div key={position.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_112px_184px] md:items-center">
                    <div className="min-w-0">
                      {editingRole ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className="h-8 rounded border border-border px-2"
                            value={editingGroupName}
                            onChange={(event) => setEditingGroupName(event.target.value)}
                            placeholder="分组名称"
                          />
                          <input
                            className="h-8 rounded border border-border px-2"
                            value={editingRoleName}
                            onChange={(event) => setEditingRoleName(event.target.value)}
                            placeholder="角色名称"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="truncate font-medium text-foreground">{displayRoleName(position)}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{position.name}</div>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {position._count?.userPositions ?? 0} 用户
                    </div>

                    <div className="flex gap-2 md:justify-end">
                      {editingRole ? (
                        <>
                          <button
                            className={actionButton()}
                            onClick={() => updatePosition(position)}
                            disabled={saving || !editingGroupName.trim() || !editingRoleName.trim()}
                            title="保存角色"
                          >
                            <Save className="h-4 w-4" />保存
                          </button>
                          <button className={actionButton()} onClick={cancelRoleEditing} disabled={saving} title="取消编辑">
                            <X className="h-4 w-4" />取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button className={actionButton()} onClick={() => startRoleEditing(position)} disabled={saving} title="编辑角色">
                            <Pencil className="h-4 w-4" />编辑
                          </button>
                          <button className={actionButton(true)} onClick={() => deletePosition(position)} disabled={saving} title="删除角色">
                            <Trash2 className="h-4 w-4" />删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
