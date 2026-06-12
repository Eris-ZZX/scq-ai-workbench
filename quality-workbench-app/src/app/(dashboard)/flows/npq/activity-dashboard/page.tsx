'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Clock3, Flag, Layers3, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Project = { id: string; name: string };
type StageMetric = { stage: string; total: number; closed: number; rate: number };
type RoleMetric = {
  roleGroup: string;
  due: number;
  onTime: number;
  rate: number;
  details: { ownerRole: string; due: number; onTime: number; rate: number }[];
};
type DashboardData = {
  parentCompletionRate: number;
  pendingClose: number;
  overdueParents: number;
  blockedParents: number;
  totalParents: number;
  closedParents: number;
  stageCompletion: StageMetric[];
  roleOnTime: RoleMetric[];
};

export default function ActivityDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    const res = await fetch(`/api/npq/activity-dashboard?projectId=${id}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '看板加载失败');
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/npq/projects');
      if (res.ok) {
        const list = await res.json();
        setProjects(list);
        const firstId = list[0]?.id ?? '';
        setProjectId(firstId);
        if (firstId) await loadDashboard(firstId);
      }
      setLoading(false);
    })();
  }, [loadDashboard]);

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">新产品导入活动管理看板</h1>
            <p className="mt-1 text-sm text-muted-foreground">查看项目活动闭环、阶段进度、风险和角色按时完成率。</p>
          </div>
          <Button variant="outline" onClick={() => loadDashboard(projectId)}>
            <RefreshCw className="mr-1 h-4 w-4" /> 刷新
          </Button>
        </div>

        <div className="mb-4 rounded-md border border-border bg-white p-4 shadow-sm">
          <label className="block max-w-md text-sm">
            <span className="mb-1 block font-medium">项目</span>
            <select value={projectId} onChange={(event) => { setProjectId(event.target.value); loadDashboard(event.target.value); }} className="w-full rounded-md border px-3 py-2">
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {!data ? (
          <div className="rounded-md border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">暂无看板数据</div>
        ) : (
          <>
            <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard icon={<BarChart3 className="h-4 w-4" />} label="项目活动完成率" value={`${data.parentCompletionRate}%`} sub={`${data.closedParents}/${data.totalParents}`} />
              <MetricCard icon={<Flag className="h-4 w-4" />} label="待NPQ关闭" value={String(data.pendingClose)} sub="项目活动" />
              <MetricCard icon={<Clock3 className="h-4 w-4" />} label="逾期项目活动" value={String(data.overdueParents)} sub="需跟进" tone="amber" />
              <MetricCard icon={<ShieldAlert className="h-4 w-4" />} label="阻塞项目活动" value={String(data.blockedParents)} sub="需协调" tone="red" />
              <MetricCard icon={<Layers3 className="h-4 w-4" />} label="阶段数量" value={String(data.stageCompletion.length)} sub="TR 分组" />
              <MetricCard icon={<BarChart3 className="h-4 w-4" />} label="角色分组" value={String(data.roleOnTime.length)} sub="按时完成率" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
              <section className="rounded-md border border-border bg-white p-4 shadow-sm">
                <h2 className="mb-4 text-base font-semibold">按阶段完成率</h2>
                <div className="space-y-3">
                  {data.stageCompletion.map((stage) => (
                    <div key={stage.stage}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{stage.stage}</span>
                        <span className="text-muted-foreground">{stage.closed}/{stage.total} · {stage.rate}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${stage.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-border bg-white p-4 shadow-sm">
                <h2 className="mb-4 text-base font-semibold">角色维度子任务按时完成率</h2>
                <div className="overflow-hidden rounded-md border">
                  <div className="grid grid-cols-[minmax(160px,1fr)_100px_100px_100px] border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>角色大类 / 负责方</span>
                    <span>应完成</span>
                    <span>按时</span>
                    <span>按时率</span>
                  </div>
                  {data.roleOnTime.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">当前没有截至今日应完成的子任务</div>
                  ) : data.roleOnTime.map((role) => {
                    const isOpen = expanded.has(role.roleGroup);
                    return (
                      <div key={role.roleGroup} className="border-b last:border-b-0">
                        <button onClick={() => setExpanded((current) => toggleSet(current, role.roleGroup))}
                          className="grid w-full grid-cols-[minmax(160px,1fr)_100px_100px_100px] items-center px-3 py-2 text-left text-sm hover:bg-muted/30">
                          <span className="flex items-center gap-2 font-medium">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {role.roleGroup}
                          </span>
                          <span>{role.due}</span>
                          <span>{role.onTime}</span>
                          <RateBadge value={role.rate} />
                        </button>
                        {isOpen && role.details.map((detail) => (
                          <div key={detail.ownerRole} className="grid grid-cols-[minmax(160px,1fr)_100px_100px_100px] bg-slate-50 px-3 py-2 text-xs">
                            <span className="pl-6 text-muted-foreground">{detail.ownerRole}</span>
                            <span>{detail.due}</span>
                            <span>{detail.onTime}</span>
                            <RateBadge value={detail.rate} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, tone = 'blue' }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: 'blue' | 'amber' | 'red' }) {
  const toneCls = tone === 'red' ? 'text-red-700 bg-red-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-blue-700 bg-blue-50';
  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded ${toneCls}`}>{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function RateBadge({ value }: { value: number }) {
  const cls = value >= 90 ? 'bg-green-100 text-green-700' : value >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{value}%</span>;
}

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
