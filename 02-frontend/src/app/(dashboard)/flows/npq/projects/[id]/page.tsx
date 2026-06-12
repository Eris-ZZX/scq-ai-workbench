'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Plus, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Position = { id: string; code: string; name: string; roleGroup: string; sortOrder: number };
type ProjectMember = {
  role: string;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    positionBinding: null | {
      positionRoleId: string;
      positionRole: { id: string; code: string; name: string; roleGroup: string };
    };
  };
};
type PositionAssignment = {
  id: string;
  positionRoleId: string;
  userId: string;
  positionRole: { id: string; code: string; name: string; roleGroup: string };
  user: { id: string; username: string; displayName: string };
};
type StageGate = {
  id: string;
  stage: string;
  status: string;
  passedAt: string | null;
  conditionReleaseNote: string | null;
  stats: { total: number; open: number; blocked: number };
};
type WorkbenchTodo = {
  id: string;
  type: string;
  stage: string;
  title: string;
  parentTitle: string;
  ownerRole: string;
  dueAt: string | null;
};
type WorkbenchProjectGroup = {
  projectId: string;
  todoCount: number;
  todos: WorkbenchTodo[];
};
type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentStage: string;
  stageGateStatus: string;
  createdAt: string;
  stages: { id: string; name: string; status: string; order: number; blockedReason?: string | null; completedAt?: string | null }[];
  tasks: { id: string; title: string; status: string; stageId: string | null }[];
  members: ProjectMember[];
  positionAssignments: PositionAssignment[];
  _count: { tasks: number };
};

const STAGE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待开始', color: 'bg-gray-200 text-gray-600' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  blocked: { label: '已阻塞', color: 'bg-red-100 text-red-700' },
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [canAssignPositions, setCanAssignPositions] = useState(false);
  const [canPassStageGate, setCanPassStageGate] = useState(false);
  const [stageGates, setStageGates] = useState<StageGate[]>([]);
  const [gateNotes, setGateNotes] = useState<Record<string, string>>({});
  const [projectTodos, setProjectTodos] = useState<WorkbenchTodo[]>([]);

  async function loadProject() {
    try {
      const [projectRes, positionsRes] = await Promise.all([
        fetch(`/api/npq/projects/${id}`),
        fetch('/api/npq/positions'),
      ]);
      if (projectRes.ok) setProject(await projectRes.json());
      else router.push('/flows/npq/projects');
      if (positionsRes.ok) setPositions(await positionsRes.json());
      const [permissionRes, gateRes] = await Promise.all([
        fetch(`/api/npq/permissions?projectId=${id}&actions=project.assign_positions,stage_gate.pass`),
        fetch(`/api/npq/projects/${id}/stage-gates`),
      ]);
      if (permissionRes.ok) {
        const permissions = await permissionRes.json();
        setCanAssignPositions(Boolean(permissions['project.assign_positions']));
        setCanPassStageGate(Boolean(permissions['stage_gate.pass']));
      }
      if (gateRes.ok) {
        const data = await gateRes.json();
        setStageGates(data.gates ?? []);
      }
      const workbenchRes = await fetch(`/api/npq/workbench?projectId=${id}`);
      if (workbenchRes.ok) {
        const data = await workbenchRes.json();
        const group = (data.projectTodos as WorkbenchProjectGroup[] | undefined)?.find((item) => item.projectId === id);
        setProjectTodos(group?.todos ?? []);
      }
    } catch {
      setErrorMsg('加载失败');
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadProject(); }, [id]);

  async function updateStageStatus(stageId: string, status: string) {
    const res = await fetch(`/api/npq/projects/${id}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { setErrorMsg('状态更新失败'); return; }
    loadProject();
    setEditingStage(null);
  }

  async function addStage() {
    const name = prompt('新阶段名称：');
    if (!name) return;
    const res = await fetch(`/api/npq/projects/${id}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { setErrorMsg('添加阶段失败'); return; }
    loadProject();
  }

  async function deleteStage(stageId: string) {
    if (!confirm('删除此阶段？关联的任务将保留。')) return;
    const res = await fetch(`/api/npq/projects/${id}/stages/${stageId}`, { method: 'DELETE' });
    if (!res.ok) { setErrorMsg('删除阶段失败'); return; }
    loadProject();
  }

  async function addMember() {
    const userId = prompt('输入要添加的用户 ID：');
    if (!userId) return;
    const res = await fetch(`/api/npq/projects/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '添加失败');
      return;
    }
    loadProject();
  }

  async function assignPosition(positionRoleId: string, userId: string) {
    const res = await fetch(`/api/npq/projects/${id}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionRoleId, userId: userId || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? '岗位任命失败');
      return;
    }
    loadProject();
  }

  async function updateStatus(newStatus: string) {
    const res = await fetch(`/api/npq/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { setErrorMsg('状态更新失败'); return; }
    loadProject();
  }

  async function passStageGate(stage: string) {
    const res = await fetch(`/api/npq/projects/${id}/stage-gates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, conditionReleaseNote: gateNotes[stage] || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? '阶段门通过失败');
      return;
    }
    setGateNotes((current) => ({ ...current, [stage]: '' }));
    loadProject();
  }

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;
  if (!project) return null;

  const completedStages = project.stages.filter((stage) => stage.status === 'completed').length;
  const progressPct = project.stages.length > 0 ? Math.round((completedStages / project.stages.length) * 100) : 0;
  const assignmentsByPosition = new Map(project.positionAssignments.map((item) => [item.positionRoleId, item]));

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <button
          onClick={() => router.push('/flows/npq/projects')}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回项目列表
        </button>

        {errorMsg && (
          <div className="mb-4 flex items-center justify-between rounded bg-red-50 px-4 py-2 text-sm text-red-600">
            {errorMsg}
            <button onClick={() => setErrorMsg('')}><X className="h-3 w-3" /></button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={project.status} onChange={(event) => updateStatus(event.target.value)} className="rounded-md border px-2 py-1 text-xs">
                <option value="active">进行中</option>
                <option value="paused">暂停</option>
                <option value="completed">已完成</option>
              </select>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">当前阶段 {project.currentStage}</span>
              <span className="text-xs text-muted-foreground">{project.stages.length} 阶段 / {project._count.tasks} 任务 / {project.members.length} 成员</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addMember}><Users className="mr-1 h-3 w-3" />添加成员</Button>
            <Button size="sm" onClick={addStage}><Plus className="mr-1 h-3 w-3" />添加阶段</Button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">当前项目待处理事项</h2>
              <p className="mt-1 text-xs text-muted-foreground">优先处理逾期、阻塞、退回和待关闭活动；点击后回到工作台抽屉处理。</p>
            </div>
            <Link href="/workbench" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary">
              打开工作台
            </Link>
          </div>
          {projectTodos.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              当前项目暂无待处理事项。
            </div>
          ) : (
            <div className="space-y-2">
              {projectTodos.slice(0, 12).map((todo) => (
                <Link
                  key={todo.id}
                  href={`/workbench?todo=${todo.id}`}
                  className="grid grid-cols-[96px_minmax(0,1fr)_92px_96px] items-center gap-3 rounded-md border border-border px-3 py-2 text-sm transition hover:border-primary hover:bg-muted/20"
                >
                  <span className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${todoTypeTone(todo.type)}`}>{todoTypeLabel(todo.type)}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{todo.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{todo.stage} / {todo.parentTitle}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{todo.ownerRole}</span>
                  <span className="text-xs text-muted-foreground">{todo.dueAt ? formatDate(todo.dueAt) : '-'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">阶段进度</span>
              <span className="text-muted-foreground">{completedStages}/{project.stages.length} / {progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="mb-3 text-sm font-medium">岗位任命</div>
            <div className="space-y-2">
              {positions.map((position) => {
                const assigned = assignmentsByPosition.get(position.id);
                const eligibleMembers = project.members.filter((member) => member.user.positionBinding?.positionRoleId === position.id);
                const memberOptions = eligibleMembers.length > 0 ? eligibleMembers : project.members;
                return (
                  <div key={position.id} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 text-sm">
                    <div className="font-mono text-xs text-muted-foreground">{position.code}</div>
                    <select
                      className="h-8 rounded border border-border px-2 text-xs"
                      value={assigned?.userId ?? ''}
                      onChange={(event) => assignPosition(position.id, event.target.value)}
                      disabled={!canAssignPositions}
                      title={canAssignPositions ? '任命项目岗位' : '当前岗位无任命权限'}
                    >
                      <option value="">未任命</option>
                      {memberOptions.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.displayName}
                          {member.user.positionBinding?.positionRole.code ? ` (${member.user.positionBinding.positionRole.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">TR 阶段门</h2>
              <p className="mt-1 text-xs text-muted-foreground">母任务已关闭且无阻塞时可直接通过；存在未关闭或阻塞项时需填写条件放行说明。</p>
            </div>
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{project.stageGateStatus}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {stageGates.map((gate) => {
              const needsCondition = gate.stats.open > 0 || gate.stats.blocked > 0;
              return (
                <div key={gate.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{gate.stage}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${
                        gate.status === 'passed' ? 'bg-green-100 text-green-700' :
                        gate.status === 'conditional_release' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {gate.status === 'passed' ? '已通过' : gate.status === 'conditional_release' ? '条件放行' : '待评审'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      母任务 {gate.stats.total} / 未关闭 {gate.stats.open} / 阻塞 {gate.stats.blocked}
                    </span>
                  </div>
                  <textarea
                    value={gateNotes[gate.stage] ?? ''}
                    onChange={(event) => setGateNotes((current) => ({ ...current, [gate.stage]: event.target.value }))}
                    className="mb-2 min-h-14 w-full rounded-md border px-3 py-2 text-xs"
                    placeholder={needsCondition ? '填写条件放行说明' : '可填写评审备注'}
                    disabled={!canPassStageGate || gate.status !== 'pending'}
                  />
                  {gate.conditionReleaseNote && <p className="mb-2 text-xs text-amber-700">{gate.conditionReleaseNote}</p>}
                  <Button
                    size="sm"
                    variant={needsCondition ? 'outline' : 'default'}
                    disabled={!canPassStageGate || gate.status !== 'pending'}
                    onClick={() => passStageGate(gate.stage)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {needsCondition ? '条件放行' : '通过阶段门'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">阶段时间线</h2>
          {project.stages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">暂未设置阶段</p>
          ) : (
            project.stages.map((stage) => {
              const statusMeta = (STAGE_STATUS_MAP[stage.status] ?? STAGE_STATUS_MAP.pending)!;
              const stageTasks = project.tasks.filter((task) => task.stageId === stage.id);
              return (
                <div key={stage.id} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
                        <span className="font-medium">{stage.name}</span>
                      </div>
                      {stage.blockedReason && <p className="mt-1 text-xs text-red-600">阻塞原因: {stage.blockedReason}</p>}
                      {stageTasks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stageTasks.map((task) => (
                            <span key={task.id} className={`rounded px-1.5 py-0.5 text-xs ${
                              task.status === 'done' ? 'bg-green-50 text-green-700' :
                              task.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {task.title.slice(0, 20)}{task.title.length > 20 ? '...' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {editingStage === stage.id ? (
                        <div className="flex gap-1">
                          {['pending', 'in_progress', 'completed', 'blocked'].map((status) => (
                            <button key={status} onClick={() => updateStageStatus(stage.id, status)} className={`rounded px-2 py-0.5 text-xs font-medium ${STAGE_STATUS_MAP[status]!.color}`}>
                              {STAGE_STATUS_MAP[status]!.label}
                            </button>
                          ))}
                          <button onClick={() => setEditingStage(null)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => setEditingStage(stage.id)} className="rounded p-1 text-xs text-muted-foreground hover:bg-muted">状态</button>
                          <button onClick={() => deleteStage(stage.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">项目成员</h2>
          <div className="flex flex-wrap gap-2">
            {project.members.map((member) => (
              <div key={member.user.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
                <span className="font-medium">{member.user.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">@{member.user.username}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                  member.role === 'owner' ? 'bg-amber-100 text-amber-700' :
                  member.role === 'observer' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'
                }`}>{member.role === 'owner' ? '负责人' : member.role === 'observer' ? '观察者' : '成员'}</span>
                {member.user.positionBinding?.positionRole && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                    {member.user.positionBinding.positionRole.code}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function todoTypeLabel(type: string) {
  const labels: Record<string, string> = {
    overdue: '逾期',
    blocked: '阻塞',
    returned: '退回',
    missing_deliverable: '缺交付件',
    responsibility: '责任项',
    pending_parent_close: '待关闭',
    stage_gate: '阶段门',
  };
  return labels[type] ?? '待处理';
}

function todoTypeTone(type: string) {
  if (type === 'overdue' || type === 'blocked' || type === 'returned') return 'bg-red-50 text-red-700';
  if (type === 'missing_deliverable' || type === 'stage_gate') return 'bg-amber-50 text-amber-700';
  if (type === 'pending_parent_close') return 'bg-green-50 text-green-700';
  return 'bg-blue-50 text-blue-700';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
