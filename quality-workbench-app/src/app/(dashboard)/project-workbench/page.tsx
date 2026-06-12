'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Settings } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

type WorkbenchRole = 'npq' | 'executor' | 'manager' | 'admin';
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
type ProjectWorkbenchData = {
  roleContext: {
    username: string;
    workbenchRole: WorkbenchRole;
    position: null | { code: string; name: string; roleGroup: string };
  };
  projectCards: ProjectCard[];
  recentEvents: RecentEvent[];
};

const ROLE_LABEL: Record<WorkbenchRole, string> = {
  npq: 'NPQ 工作台',
  executor: '执行工作台',
  manager: '管理者视角',
  admin: '系统管理员',
};

export default function ProjectWorkbenchPage() {
  const [data, setData] = useState<ProjectWorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/npq/workbench');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '项目工作台加载失败');
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

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载项目工作台...</div>;
  if (!data) return <div className="p-8 text-sm text-red-600">{error || '项目工作台不可用'}</div>;

  const role = data.roleContext.workbenchRole;
  const showProjectTodos = role !== 'admin';

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
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{data.roleContext.username}，项目工作台</h1>
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
            <button onClick={() => setError('')}>关闭</button>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main>
            <section className="rounded-lg border border-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">我的项目</h2>
                <span className="text-xs text-muted-foreground">按关注程度排序</span>
              </div>
              {data.projectCards.length === 0 ? (
                <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                  暂无项目
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.projectCards.map((project) => (
                    <Link key={project.projectId} href={`/flows/npq/projects/${project.projectId}`} className="rounded-md border border-border p-3 transition hover:border-primary hover:bg-muted/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{project.projectName}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span>{project.currentStage}</span>
                            {showProjectTodos && (
                              <>
                                <span>{project.todoCount} 待处理</span>
                                {project.riskFlags.map((flag) => <RiskFlag key={flag} flag={flag} />)}
                              </>
                            )}
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
              )}
            </section>
          </main>

          <aside>
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
                      <div className="mt-1 text-muted-foreground">{event.actorName ?? '系统'} / {event.actionType}</div>
                      {event.note && <div className="mt-1 text-amber-700">{event.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RiskFlag({ flag }: { flag: string }) {
  const cls = flag === '逾期' || flag === '阻塞' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{flag}</span>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
