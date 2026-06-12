'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  stages: { id: string; name: string; status: string; order: number }[];
  _count: { tasks: number };
  members: { userId: string; user: { id: string; username: string; displayName: string }; role: string }[];
};
type ActivityTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number | null;
  stats: { stageCount: number; parentCount: number; childCount: number };
};
type Position = { id: string; code: string; name: string };
type User = {
  id: string;
  username: string;
  displayName: string;
  positionBinding: null | { positionRoleId: string; positionRole: { code: string; name: string } };
};

const steps = ['项目信息', '模板选择', '岗位任命', '预览生成'];

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    activityTemplateSetId: '',
    assignments: {} as Record<string, string>,
  });

  async function loadProjects() {
    const res = await fetch('/api/npq/projects');
    if (res.ok) setProjects(await res.json());
  }

  useEffect(() => {
    (async () => {
      const [templateRes, positionRes, userRes, permissionRes] = await Promise.all([
        fetch('/api/npq/activity-templates'),
        fetch('/api/npq/positions'),
        fetch('/api/npq/users'),
        fetch('/api/npq/permissions?actions=project.create'),
      ]);
      if (templateRes.ok) {
        const data = await templateRes.json();
        setTemplates(data);
        setForm((current) => ({ ...current, activityTemplateSetId: current.activityTemplateSetId || data[0]?.id || '' }));
      }
      if (positionRes.ok) setPositions(await positionRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (permissionRes.ok) {
        const permissions = await permissionRes.json();
        setCanCreateProject(Boolean(permissions['project.create']));
      }
      await loadProjects();
      setLoading(false);
    })();
  }, []);

  const selectedTemplate = templates.find((template) => template.id === form.activityTemplateSetId);
  const assignmentRows = useMemo(() => positions.map((position) => {
    const matchedUsers = users.filter((user) => user.positionBinding?.positionRoleId === position.id);
    return { position, users: matchedUsers.length > 0 ? matchedUsers : users };
  }), [positions, users]);

  async function handleCreate() {
    setError('');
    const name = form.name.trim();
    if (!name) { setError('请填写项目名称'); setStep(0); return; }
    if (!form.activityTemplateSetId) { setError('请选择活动模板'); setStep(1); return; }

    const positionAssignments = Object.entries(form.assignments)
      .filter(([, userId]) => Boolean(userId))
      .map(([positionRoleId, userId]) => ({ positionRoleId, userId }));
    const res = await fetch('/api/npq/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: form.description.trim(),
        activityTemplateSetId: form.activityTemplateSetId,
        positionAssignments,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '创建失败');
      return;
    }
    setShowCreate(false);
    setStep(0);
    setForm({ name: '', description: '', activityTemplateSetId: templates[0]?.id ?? '', assignments: {} });
    await loadProjects();
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此项目？所有阶段、任务和活动实例将被删除。')) return;
    const res = await fetch(`/api/npq/projects/${id}`, { method: 'DELETE' });
    if (res.ok) loadProjects();
  }

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">新品质量策划 / 项目管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">NPI 项目看板 / {projects.length} 个项目</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} disabled={!canCreateProject} title={canCreateProject ? '新建项目' : '当前岗位无项目创建权限'}>
            <Plus className="mr-1 h-4 w-4" />新建项目
          </Button>
        </div>

        {showCreate && (
          <div className="mb-6 rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 grid grid-cols-4 gap-2">
              {steps.map((label, index) => (
                <button key={label} onClick={() => setStep(index)} className={`rounded border px-3 py-2 text-sm ${step === index ? 'border-ws-blue bg-blue-50 text-ws-blue' : 'border-border text-muted-foreground'}`}>
                  {index + 1}. {label}
                </button>
              ))}
            </div>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">项目名称</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border px-3 py-2" />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">描述</span>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-md border px-3 py-2" rows={3} />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <button key={template.id} onClick={() => setForm((current) => ({ ...current, activityTemplateSetId: template.id }))} className={`rounded-lg border p-4 text-left ${form.activityTemplateSetId === template.id ? 'border-ws-blue bg-blue-50' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{template.name}</span>
                      {form.activityTemplateSetId === template.id && <Check className="h-4 w-4 text-ws-blue" />}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">v{template.version} / {template.stats.stageCount} 阶段 / {template.stats.parentCount} 母任务 / {template.stats.childCount} 子任务</div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-2 md:grid-cols-2">
                {assignmentRows.map(({ position, users: options }) => (
                  <label key={position.id} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-2 rounded border border-border p-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{position.code}</span>
                    <select value={form.assignments[position.id] ?? ''} onChange={(event) => setForm((current) => ({ ...current, assignments: { ...current.assignments, [position.id]: event.target.value } }))} className="h-8 rounded border px-2 text-xs">
                      <option value="">暂不任命</option>
                      {options.map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName}{user.positionBinding?.positionRole.code ? ` (${user.positionBinding.positionRole.code})` : ''}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Summary label="项目名称" value={form.name || '-'} />
                <Summary label="活动模板" value={selectedTemplate ? `${selectedTemplate.name} v${selectedTemplate.version}` : '-'} />
                <Summary label="任命岗位" value={`${Object.values(form.assignments).filter(Boolean).length}/${positions.length}`} />
                <Summary label="将生成" value={selectedTemplate ? `${selectedTemplate.stats.parentCount} 母任务` : '-'} />
                <Summary label="子任务" value={selectedTemplate ? `${selectedTemplate.stats.childCount} 子任务` : '-'} />
                <Summary label="规则" value="绑定最新发布版并生成项目快照" />
              </div>
            )}

            <div className="mt-5 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ChevronLeft className="mr-1 h-4 w-4" />上一步</Button>
                {step < 3 ? (
                  <Button type="button" onClick={() => setStep((current) => Math.min(3, current + 1))}>下一步<ChevronRight className="ml-1 h-4 w-4" /></Button>
                ) : (
                  <Button type="button" onClick={handleCreate} disabled={!canCreateProject}>生成项目</Button>
                )}
              </div>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center text-sm text-muted-foreground">暂无项目</div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/flows/npq/projects/${project.id}`} className="group block rounded-lg border border-border bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-lg font-semibold text-foreground group-hover:text-primary">{project.name}</span>
                    {project.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{project.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor(project.status)}`}>{statusLabel(project.status)}</span>
                      <span><Users className="mr-1 inline h-3 w-3" />{project.members.length} 成员</span>
                      <span>{project.stages.length} 阶段</span>
                      <span>{project._count.tasks} 任务</span>
                    </div>
                  </div>
                  <button onClick={(event) => { event.preventDefault(); handleDelete(project.id); }} className="ml-4 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="删除项目">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'completed') return '已完成';
  return '暂停';
}

function statusColor(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'completed') return 'bg-muted text-muted-foreground';
  return 'bg-amber-100 text-amber-700';
}
