'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Download,
  FileUp,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

type WorkbenchRole = 'npq' | 'executor' | 'manager' | 'admin';
type TodoType = 'overdue' | 'blocked' | 'returned' | 'missing_deliverable' | 'responsibility' | 'pending_parent_close' | 'stage_gate';
type WorkbenchTodo = {
  id: string;
  type: TodoType;
  projectId: string;
  parentId: string | null;
  childId: string | null;
  stage: string;
  title: string;
  parentTitle: string;
  ownerRole: string;
  status: string;
  dueAt: string | null;
  priorityRank: number;
  allowedActions: string[];
};
type ProjectTodoGroup = {
  projectId: string;
  projectName: string;
  currentStage: string;
  riskFlags: string[];
  todoCount: number;
  todos: WorkbenchTodo[];
};
type ProjectCard = {
  projectId: string;
  projectName: string;
  currentStage: string;
  progressPercent: number;
  todoCount: number;
  riskFlags: string[];
  updatedAt: string;
};
type RecentEvent = {
  id: string;
  projectId: string;
  projectName: string;
  actionType: string;
  note: string | null;
  actorName: string | null;
  createdAt: string;
};
type WorkbenchData = {
  roleContext: {
    userId: string;
    username: string;
    displayName: string;
    appRole: string;
    workbenchRole: WorkbenchRole;
    position: null | { code: string; name: string; roleGroup: string };
  };
  actionMetrics: {
    totalTodo: number;
    overdue: number;
    blocked: number;
    missingDeliverable: number;
    pendingParentClose: number;
  };
  projectTodos: ProjectTodoGroup[];
  projectCards: ProjectCard[];
  recentEvents: RecentEvent[];
};
type ActivityAttachment = { id: string; fileName: string; sizeBytes: number | null; createdAt: string };
type ChildDetail = {
  id: string;
  projectId: string;
  parentId: string;
  thirdLevelPlan: string;
  ownerRole: string;
  status: string;
  requiresDeliverable: boolean;
  requiresAttachment: boolean;
  deliverableName: string | null;
  deliverableUrl: string | null;
  completionNote: string | null;
  blockerNote: string | null;
  isBlocked: boolean;
  isNotApplicable: boolean;
  notApplicableReason: string | null;
  plannedDueDateOverride: string | null;
  parent: { stage: string; projectTaskName: string; plannedDueDate: string | null };
  attachments?: ActivityAttachment[];
};

const TODO_LABEL: Record<TodoType, string> = {
  overdue: '逾期',
  blocked: '阻塞',
  returned: '退回',
  missing_deliverable: '缺交付件',
  responsibility: '责任项',
  pending_parent_close: '待关闭',
  stage_gate: '阶段门',
};

const ROLE_LABEL: Record<WorkbenchRole, string> = {
  npq: 'NPQ 工作台',
  executor: '执行工作台',
  manager: '管理者视角',
  admin: '系统管理员',
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'overdue', label: '逾期' },
  { key: 'blocked', label: '阻塞' },
  { key: 'missing_deliverable', label: '缺交付件' },
  { key: 'pending_parent_close', label: '待关闭' },
] as const;

export default function WorkbenchPage() {
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selectedTodo, setSelectedTodo] = useState<WorkbenchTodo | null>(null);
  const [selectedChild, setSelectedChild] = useState<ChildDetail | null>(null);

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/npq/workbench');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '工作台加载失败');
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const groups = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data.projectTodos;
    return data.projectTodos
      .map((group) => ({ ...group, todos: group.todos.filter((todo) => todo.type === activeFilter) }))
      .filter((group) => group.todos.length > 0);
  }, [activeFilter, data]);

  const openTodo = useCallback(async (todo: WorkbenchTodo) => {
    setSelectedTodo(todo);
    setSelectedChild(null);
    if (!todo.childId) return;
    const res = await fetch(`/api/npq/activities/children/${todo.childId}`);
    if (res.ok) setSelectedChild(await res.json());
  }, []);

  useEffect(() => {
    if (!data || selectedTodo) return;
    const todoId = new URLSearchParams(window.location.search).get('todo');
    if (!todoId) return;
    const todo = data.projectTodos.flatMap((group) => group.todos).find((item) => item.id === todoId);
    if (!todo) return;
    const timer = window.setTimeout(() => void openTodo(todo), 0);
    return () => window.clearTimeout(timer);
  }, [data, openTodo, selectedTodo]);

  async function afterAction() {
    await load();
    if (selectedTodo?.childId) {
      const res = await fetch(`/api/npq/activities/children/${selectedTodo.childId}`);
      if (res.ok) setSelectedChild(await res.json());
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载工作台...</div>;
  if (!data) return <div className="p-8 text-sm text-red-600">{error || '工作台不可用'}</div>;

  const role = data.roleContext.workbenchRole;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-6 py-7">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date().toLocaleDateString('zh-CN')}</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{ROLE_LABEL[role]}</span>
              {data.roleContext.position && <span>{data.roleContext.position.code}</span>}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{data.roleContext.displayName}，今天先看这些项目</h1>
          </div>
          <div className="flex gap-2">
            {role === 'admin' && (
              <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
                <Settings className="mr-1 h-4 w-4" /> 后台配置
              </Link>
            )}
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-4 w-4" /> 刷新
            </Button>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        <section className="mb-5 grid gap-3 md:grid-cols-5">
          <Metric label="待处理" value={data.actionMetrics.totalTodo} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
          <Metric label="逾期" value={data.actionMetrics.overdue} tone="red" active={activeFilter === 'overdue'} onClick={() => setActiveFilter('overdue')} />
          <Metric label="阻塞" value={data.actionMetrics.blocked} tone="red" active={activeFilter === 'blocked'} onClick={() => setActiveFilter('blocked')} />
          <Metric label="缺交付件" value={data.actionMetrics.missingDeliverable} tone="amber" active={activeFilter === 'missing_deliverable'} onClick={() => setActiveFilter('missing_deliverable')} />
          <Metric label="待关闭" value={data.actionMetrics.pendingParentClose} tone="green" active={activeFilter === 'pending_parent_close'} onClick={() => setActiveFilter('pending_parent_close')} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">按项目分组的待处理任务</h2>
                <div className="flex gap-1">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className={`rounded px-2 py-1 text-xs ${activeFilter === filter.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              {groups.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">当前筛选下暂无待处理事项</div>
              ) : (
                <div className="divide-y divide-border">
                  {groups.map((group) => (
                    <div key={group.projectId} className="p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/flows/npq/projects/${group.projectId}`} className="font-semibold text-foreground hover:text-primary">{group.projectName}</Link>
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{group.currentStage}</span>
                            {group.riskFlags.map((flag) => <RiskFlag key={flag} flag={flag} />)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{group.todoCount} 个待处理事项</div>
                        </div>
                        <Link href={`/flows/npq/projects/${group.projectId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                          进入项目
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {group.todos.map((todo) => (
                          <TodoRow key={todo.id} todo={todo} selected={selectedTodo?.id === todo.id} onClick={() => void openTodo(todo)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">相关项目状态</h2>
                <span className="text-xs text-muted-foreground">按关注程度排序</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.projectCards.map((project) => (
                  <Link key={project.projectId} href={`/flows/npq/projects/${project.projectId}`} className="rounded-md border border-border p-3 transition hover:border-primary hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{project.projectName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span>{project.currentStage}</span>
                          <span>{project.todoCount} 待处理</span>
                          {project.riskFlags.map((flag) => <RiskFlag key={flag} flag={flag} />)}
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-foreground">{project.progressPercent}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="space-y-5">
            <section className="rounded-lg border border-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">最近动态</h2>
              {data.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无动态</p>
              ) : (
                <div className="space-y-2">
                  {data.recentEvents.slice(0, 12).map((event) => (
                    <div key={event.id} className="rounded border bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{event.projectName}</span>
                        <span className="shrink-0 text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground">{event.actorName ?? '系统'} · {event.actionType}</div>
                      {event.note && <div className="mt-1 text-amber-700">{event.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {selectedTodo && (
        <WorkbenchDrawer
          key={`${selectedTodo.id}:${selectedChild?.id ?? 'loading'}`}
          role={role}
          todo={selectedTodo}
          child={selectedChild}
          onClose={() => {
            setSelectedTodo(null);
            setSelectedChild(null);
          }}
          onAction={afterAction}
          setError={setError}
        />
      )}
    </div>
  );
}

function Metric({ label, value, active, tone = 'blue', onClick }: { label: string; value: number; active: boolean; tone?: 'blue' | 'red' | 'amber' | 'green'; onClick: () => void }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-green-700' : 'text-blue-700';
  return (
    <button onClick={onClick} className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-primary ${active ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

function TodoRow({ todo, selected, onClick }: { todo: WorkbenchTodo; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`grid w-full grid-cols-[96px_minmax(0,1fr)_96px_110px] items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${selected ? 'border-primary bg-blue-50/50' : 'border-border hover:bg-muted/30'}`}>
      <span className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${todoTone(todo.type)}`}>{TODO_LABEL[todo.type]}</span>
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{todo.title}</div>
        <div className="truncate text-xs text-muted-foreground">{todo.stage} / {todo.parentTitle}</div>
      </div>
      <span className="text-xs text-muted-foreground">{todo.ownerRole}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> {todo.dueAt ? formatDate(todo.dueAt) : '-'}
      </span>
    </button>
  );
}

function WorkbenchDrawer({
  role,
  todo,
  child,
  onClose,
  onAction,
  setError,
}: {
  role: WorkbenchRole;
  todo: WorkbenchTodo;
  child: ChildDetail | null;
  onClose: () => void;
  onAction: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    status: child?.status ?? '',
    deliverableUrl: child?.deliverableUrl ?? '',
    completionNote: child?.completionNote ?? '',
    blockerNote: child?.blockerNote ?? '',
    isBlocked: child?.isBlocked ?? false,
    returnReason: '',
    isNotApplicable: child?.isNotApplicable ?? false,
    notApplicableReason: child?.notApplicableReason ?? '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function patchChild(extra?: Partial<typeof draft>) {
    if (!todo.childId) return;
    setSaving(true);
    const payload = { ...draft, ...extra };
    const res = await fetch(`/api/npq/activities/children/${todo.childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: payload.status || undefined,
        deliverableUrl: payload.deliverableUrl || null,
        completionNote: payload.completionNote || null,
        blockerNote: payload.blockerNote || null,
        isBlocked: payload.isBlocked,
        returnReason: payload.returnReason || null,
        isNotApplicable: payload.isNotApplicable,
        notApplicableReason: payload.notApplicableReason || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '保存失败');
      return;
    }
    await onAction();
  }

  async function closeParent() {
    if (!todo.parentId) return;
    setSaving(true);
    const res = await fetch(`/api/npq/activities/parents/${todo.parentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ close: true }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '母任务关闭失败');
      return;
    }
    await onAction();
  }

  async function upload(file: File) {
    if (!todo.childId) return;
    setSaving(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/npq/activities/children/${todo.childId}/attachments`, { method: 'POST', body: form });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '附件上传失败');
      return;
    }
    await onAction();
  }

  const readOnly = role === 'manager' || role === 'admin';
  const canManage = role === 'npq';
  const canExecute = role === 'npq' || role === 'executor';

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <PanelRightOpen className="h-4 w-4" />
            <span>{TODO_LABEL[todo.type]}</span>
            <span>{todo.stage}</span>
            {readOnly && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">只读</span>}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{todo.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{todo.parentTitle}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      {todo.type === 'pending_parent_close' ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-green-50 p-3 text-sm text-green-800">
            母任务下的涉及子任务已完成，等待 NPQ 最终关闭。
          </div>
          {canManage && <Button disabled={saving} onClick={closeParent}><ShieldCheck className="mr-1 h-4 w-4" /> 关闭母任务</Button>}
        </div>
      ) : todo.type === 'stage_gate' ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-800">
            当前阶段仍存在未关闭或异常事项，请进入项目查看阶段门与剩余任务。
          </div>
          <Link href={`/flows/npq/projects/${todo.projectId}`} className={buttonVariants({ variant: 'outline' })}>进入项目</Link>
        </div>
      ) : !child ? (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">正在加载任务详情...</div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">提交标准</div>
            <div className="mt-1">{child.deliverableName || '无需文件型交付件，完成时需填写完成说明。'}</div>
          </div>

          <label className="block">
            <span className="mb-1 block font-medium">状态</span>
            <select disabled={readOnly} value={draft.status} onChange={(event) => setDraft((d) => ({ ...d, status: event.target.value }))} className="w-full rounded-md border px-3 py-2">
              <option value="not_started">未开始</option>
              <option value="in_progress">进行中</option>
              <option value="returned">已退回</option>
              <option value="completed">已完成</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-medium">交付件链接 / 文件说明</span>
            <textarea disabled={readOnly} value={draft.deliverableUrl} onChange={(event) => setDraft((d) => ({ ...d, deliverableUrl: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
          </label>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">附件</span>
              {canExecute && (
                <>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => fileRef.current?.click()}><FileUp className="mr-1 h-4 w-4" /> 上传</Button>
                  <input ref={fileRef} type="file" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.currentTarget.value = '';
                  }} />
                </>
              )}
            </div>
            {(child.attachments?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">暂无附件</p>
            ) : (
              <div className="space-y-2">
                {child.attachments?.map((attachment) => (
                  <a key={attachment.id} href={`/api/npq/attachments/${attachment.id}`} className="flex items-center justify-between rounded border bg-muted/20 px-2 py-1 text-xs hover:bg-muted">
                    <span className="truncate">{attachment.fileName}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block font-medium">完成说明</span>
            <textarea disabled={readOnly} value={draft.completionNote} onChange={(event) => setDraft((d) => ({ ...d, completionNote: event.target.value }))} className="min-h-20 w-full rounded-md border px-3 py-2" />
          </label>

          <label className="flex items-center gap-2">
            <input disabled={readOnly} type="checkbox" checked={draft.isBlocked} onChange={(event) => setDraft((d) => ({ ...d, isBlocked: event.target.checked }))} />
            <span className="font-medium">标记阻塞</span>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">阻塞说明</span>
            <textarea disabled={readOnly} value={draft.blockerNote} onChange={(event) => setDraft((d) => ({ ...d, blockerNote: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
          </label>

          {canManage && (
            <>
              <label className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                <input type="checkbox" checked={draft.isNotApplicable} onChange={(event) => setDraft((d) => ({ ...d, isNotApplicable: event.target.checked }))} />
                <span className="font-medium">本项目不涉及</span>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">不涉及/退回说明</span>
                <textarea value={draft.notApplicableReason || draft.returnReason} onChange={(event) => setDraft((d) => ({ ...d, notApplicableReason: event.target.value, returnReason: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {canExecute && <Button disabled={saving} onClick={() => void patchChild()}><Save className="mr-1 h-4 w-4" /> 保存</Button>}
            {canExecute && <Button variant="outline" disabled={saving} onClick={() => void patchChild({ status: 'completed' })}><CheckCircle2 className="mr-1 h-4 w-4" /> 完成</Button>}
            {canManage && <Button variant="outline" disabled={saving} onClick={() => void patchChild({ returnReason: draft.returnReason || draft.notApplicableReason || 'NPQ 退回补充' })}><RotateCcw className="mr-1 h-4 w-4" /> 退回</Button>}
          </div>
        </div>
      )}
    </aside>
  );
}

function RiskFlag({ flag }: { flag: string }) {
  const cls = flag === '逾期' || flag === '阻塞' ? 'bg-red-100 text-red-700' : flag === '待关闭' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{flag}</span>;
}

function todoTone(type: TodoType) {
  if (type === 'overdue' || type === 'blocked') return 'bg-red-100 text-red-700';
  if (type === 'returned' || type === 'missing_deliverable' || type === 'stage_gate') return 'bg-amber-100 text-amber-700';
  if (type === 'pending_parent_close') return 'bg-green-100 text-green-700';
  return 'bg-blue-50 text-blue-700';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
