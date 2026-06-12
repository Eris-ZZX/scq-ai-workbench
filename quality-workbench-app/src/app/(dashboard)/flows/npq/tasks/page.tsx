'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TaskInfo = {
  id: string; title: string; description: string | null;
  status: string; priority: string; projectId: string; stageId: string | null; assigneeMemberId: string | null;
  creatorId: string; completedAt: string | null; createdAt: string;
  stage: { id: string; name: string; status: string } | null;
  assigneeMember: { id: string; user: { id: string; username: string; displayName: string } } | null;
  creator: { id: string; username: string; displayName: string };
};

type MemberInfo = { id: string; user: { id: string; username: string; displayName: string }; role: string };

const STATUS_MAP: Record<string, string> = { todo: '待处理', in_progress: '进行中', done: '已完成' };
const STATUS_COLOR: Record<string, string> = { todo: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' };
const PRIORITY_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高', urgent: '紧急' };

export default function TasksPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') ?? '';

  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [stageId, setStageId] = useState('');
  const [error, setError] = useState('');
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);

  async function loadTasks() {
    if (!projectId) { setLoading(false); return; }
    const [tRes, mRes, pRes] = await Promise.all([
      fetch(`/api/npq/tasks?projectId=${projectId}`),
      fetch(`/api/npq/projects/${projectId}/members`),
      fetch(`/api/npq/projects/${projectId}`),
    ]);
    if (tRes.ok) setTasks(await tRes.json());
    if (mRes.ok) setMembers(await mRes.json());
    if (pRes.ok) {
      const p = await pRes.json();
      setStages(p.stages ?? []);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadTasks(); }, [projectId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return;
    const res = await fetch('/api/npq/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, priority, projectId, assigneeMemberId: assignee || undefined, stageId: stageId || undefined }),
    });
    if (res.ok) { setTitle(''); setDesc(''); setShowCreate(false); loadTasks(); }
    else { const d = await res.json(); setError(d.error ?? '创建失败'); }
  }

  async function handleStatus(taskId: string, status: string) {
    const res = await fetch(`/api/npq/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '状态更新失败');
      return;
    }
    loadTasks();
  }

  async function handleDelete(taskId: string) {
    if (!confirm('确定删除此任务？')) return;
    const res = await fetch(`/api/npq/tasks/${taskId}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '删除失败');
      return;
    }
    loadTasks();
  }

  if (!projectId) return <div className="p-8 text-center text-muted-foreground">请从项目页进入任务管理</div>;
  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href={`/flows/npq/projects/${projectId}`} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 返回项目
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">任务流转</h1>
          <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-1 h-4 w-4" /> 新建任务</Button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="mb-6 rounded-lg border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">创建任务</h2>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">标题 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">优先级</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">执行者</label>
                <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">未分配</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.user.displayName} (@{m.user.username})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">关联阶段</label>
                <select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">不关联</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">描述</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">创建</Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </form>
        )}

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center">
            <p className="text-muted-foreground">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="flex items-start justify-between rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? ''}`}>
                      {STATUS_MAP[t.status] ?? t.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                    {t.stage && <span className="text-xs text-muted-foreground">📋 {t.stage.name}</span>}
                    <span className="font-medium">{t.title}</span>
                  </div>
                  {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>创建: {t.creator.displayName}</span>
                    {t.assigneeMember && <span>指派: {t.assigneeMember.user.displayName}</span>}
                    {t.completedAt && <span>完成: {new Date(t.completedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-1">
                  {t.status !== 'done' && (
                    <select value={t.status} onChange={e => handleStatus(t.id, e.target.value)}
                      className="rounded-md border px-2 py-1 text-xs">
                      {['todo', 'in_progress', 'done'].map(s => <option key={s} value={s}>{STATUS_MAP[s]}</option>)}
                    </select>
                  )}
                  <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
