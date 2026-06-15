'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
  nextTodo: Pick<WorkbenchTodo, 'id' | 'type' | 'title' | 'parentTitle' | 'stage' | 'dueAt'> | null;
  riskFlags: string[];
  updatedAt: string;
};
type WorkbenchData = {
  roleContext: {
    userId: string;
    username: string;
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
};

type TodoFilter = 'all' | 'overdue' | 'blocked' | 'returned' | 'pending_parent_close';
type TodoWithProject = WorkbenchTodo & { projectName: string; currentStage: string };

const TODO_LABEL: Record<TodoType, string> = {
  overdue: '逾期',
  blocked: '阻塞',
  returned: '退回',
  missing_deliverable: '补交付件',
  responsibility: '待处理',
  pending_parent_close: '待确认关闭',
  stage_gate: '阶段门',
};

const FILTERS: Array<{ key: TodoFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'overdue', label: '逾期' },
  { key: 'blocked', label: '阻塞' },
  { key: 'returned', label: '退回' },
  { key: 'pending_parent_close', label: '待确认关闭' },
];

export default function WorkbenchPage() {
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch('/api/npq/workbench', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '个人项目工作台加载失败');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : '个人项目工作台加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const todos = useMemo<TodoWithProject[]>(() => {
    if (!data) return [];
    return data.projectTodos
      .flatMap((group) => group.todos.map((todo) => ({
        ...todo,
        projectName: group.projectName,
        currentStage: group.currentStage,
      })))
      .sort((a, b) => a.priorityRank - b.priorityRank);
  }, [data]);

  const filteredTodos = useMemo(() => (
    filter === 'all' ? todos : todos.filter((todo) => todo.type === filter)
  ), [filter, todos]);

  const filterCounts = useMemo(() => {
    const counts: Record<TodoFilter, number> = {
      all: todos.length,
      overdue: 0,
      blocked: 0,
      returned: 0,
      pending_parent_close: 0,
    };
    for (const todo of todos) {
      if (todo.type in counts) counts[todo.type as TodoFilter] += 1;
    }
    return counts;
  }, [todos]);

  const projects = useMemo(() => {
    if (!data) return [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return data.projectCards;
    return data.projectCards.filter((project) => project.projectName.toLowerCase().includes(keyword));
  }, [data, query]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载个人项目工作台...</div>;
  if (!data) return <div className="p-8 text-sm text-red-600">{error || '个人项目工作台不可用'}</div>;

  const roleName = data.roleContext.position?.name ?? roleFallback(data.roleContext.workbenchRole);

  return (
    <div className="min-h-screen bg-slate-50/80 px-5 py-5 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{roleName}</p>
            <h1 className="mt-1 text-xl font-semibold">个人项目工作台</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            刷新
          </Button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">我的待处理任务</h2>
              <p className="mt-0.5 text-xs text-slate-500">按阶段门、阻塞、逾期、待确认关闭和个人责任项排序</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={filter === item.key ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <span className="ml-1 text-[11px] opacity-75">{filterCounts[item.key]}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTodos.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center px-4 py-8 text-sm text-slate-500">
                当前筛选下没有待处理任务
              </div>
            ) : (
              filteredTodos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} />
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">我的项目</h2>
              <p className="mt-0.5 text-xs text-slate-500">优先展示需要推进或存在风险的项目</p>
            </div>
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索项目名称"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                没有匹配的项目
              </div>
            ) : (
              projects.map((project) => (
                <ProjectCardView key={project.projectId} project={project} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TodoRow({ todo }: { todo: TodoWithProject }) {
  return (
    <Link
      href={projectTaskHref(todo.projectId, todo.id)}
      className="grid grid-cols-[108px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
    >
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-semibold ${todoTone(todo.type)}`}>
        {TODO_LABEL[todo.type]}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-950">{todo.stage} {todo.title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {todo.projectName} / {todo.stage} / {todo.parentTitle} / {todo.ownerRole}
          {todo.dueAt ? ` / ${formatDate(todo.dueAt)}` : ''}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

function ProjectCardView({ project }: { project: ProjectCard }) {
  return (
    <Link
      href={`/flows/npq/projects/${project.projectId}`}
      className="flex min-h-44 flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{project.projectName}</div>
          <div className="mt-1 text-xs text-slate-500">当前阶段：{project.currentStage}</div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{project.todoCount} 项待办</span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>当前阶段进度</span>
          <span>{project.progressPercent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(project.progressPercent, 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.riskFlags.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> 平稳推进
          </span>
        ) : (
          project.riskFlags.map((flag) => (
            <span key={flag} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {flag}
            </span>
          ))
        )}
      </div>

      <div className="mt-auto pt-3">
        {project.nextTodo ? (
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="truncate text-xs font-medium text-slate-800">下一步：{project.nextTodo.title}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {project.nextTodo.stage} / {project.nextTodo.parentTitle}
              {project.nextTodo.dueAt ? ` / ${formatDate(project.nextTodo.dueAt)}` : ''}
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">当前没有需要立即处理的任务</div>
        )}
        <div className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'mt-2 w-full justify-center' })}>
          进入项目工作区
        </div>
      </div>
    </Link>
  );
}

function projectTaskHref(projectId: string, todoId: string) {
  return `/flows/npq/projects/${projectId}?todo=${encodeURIComponent(todoId)}`;
}

function roleFallback(role: WorkbenchRole) {
  const map: Record<WorkbenchRole, string> = {
    npq: 'NPQ',
    executor: '执行角色',
    manager: '管理者',
    admin: '系统管理员',
  };
  return map[role];
}

function todoTone(type: TodoType) {
  const tones: Record<TodoType, string> = {
    overdue: 'bg-red-50 text-red-700',
    blocked: 'bg-amber-50 text-amber-700',
    returned: 'bg-orange-50 text-orange-700',
    missing_deliverable: 'bg-sky-50 text-sky-700',
    responsibility: 'bg-slate-100 text-slate-700',
    pending_parent_close: 'bg-teal-50 text-teal-700',
    stage_gate: 'bg-indigo-50 text-indigo-700',
  };
  return tones[type];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}
