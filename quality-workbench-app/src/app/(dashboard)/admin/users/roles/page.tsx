'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');

  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [positions],
  );

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/admin/positions');
      if (!res.ok) { setError('加载岗位失败'); return; }
      setPositions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载岗位失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createPosition() {
    const name = newName.trim();
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
      setError(body.error ?? '创建岗位失败');
      return;
    }
    setNewName('');
    load();
  }

  async function updatePosition(position: Position) {
    const name = editingName.trim();
    if (!name || name === position.name) { cancelEditing(); return; }
    setSaving(true);
    const res = await fetch('/api/admin/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: position.id, name }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '更新岗位失败');
      return;
    }
    cancelEditing();
    load();
  }

  async function deletePosition(position: Position) {
    if (!window.confirm(`删除岗位"${position.name}"？`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/positions?id=${encodeURIComponent(position.id)}`, { method: 'DELETE' });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '删除岗位失败');
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
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ws-blue">
            <ArrowLeft className="h-3.5 w-3.5" />用户管理
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <BriefcaseBusiness className="h-4 w-4" />Admin / Positions
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">岗位管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理用户可绑定的岗位列表，钉钉登录时自动同步。</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <section className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">新增岗位</h2>
            <div className="text-xs text-muted-foreground">{positions.length} 个岗位</div>
          </div>

          <div className="flex gap-2 border-b border-border p-3">
            <input
              className="h-9 flex-1 rounded border border-border px-2 text-sm"
              placeholder="岗位名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createPosition(); }}
            />
            <button className={actionButton()} onClick={createPosition} disabled={saving || !newName.trim()}>
              <Plus className="h-4 w-4" />新增
            </button>
          </div>

          {sortedPositions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">暂无岗位</div>
          ) : (
            <div className="divide-y divide-border">
              {sortedPositions.map((position) => {
                const editing = editingId === position.id;
                return (
                  <div key={position.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <input
                          className="h-8 w-full rounded border border-border px-2"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') updatePosition(position); if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <div className="truncate font-medium text-foreground">{position.name}</div>
                      )}
                    </div>

                    <div className="shrink-0 text-xs text-muted-foreground">
                      {position._count?.userPositions ?? 0} 用户
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {editing ? (
                        <>
                          <button className={actionButton()} onClick={() => updatePosition(position)} disabled={saving || !editingName.trim()}>
                            <Save className="h-4 w-4" />保存
                          </button>
                          <button className={actionButton()} onClick={cancelEditing} disabled={saving}>
                            <X className="h-4 w-4" />取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button className={actionButton()} onClick={() => startEditing(position)} disabled={saving}>
                            <Pencil className="h-4 w-4" />编辑
                          </button>
                          <button className={actionButton(true)} onClick={() => deletePosition(position)} disabled={saving}>
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
