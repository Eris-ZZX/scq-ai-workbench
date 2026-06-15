'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

type WorkbenchRole = 'npq' | 'executor' | 'manager' | 'admin';
type Selection =
  | { kind: 'stage'; stage: string }
  | { kind: 'parent'; parentId: string }
  | { kind: 'child'; parentId: string; childId: string };

type ProjectMember = {
  role: string;
  userId: string;
  user: {
    id: string;
    username: string;
    positionBinding: null | {
      positionRoleId: string;
      positionRole: { id: string; code: string; name: string; roleGroup: string };
    };
  };
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentStage: string;
  stageGateStatus: string;
  createdAt: string;
  stages: { id: string; name: string; status: string; order: number }[];
  tasks: { id: string; title: string; status: string; stageId: string | null }[];
  members: ProjectMember[];
  _count: { tasks: number };
};

type ActivityAttachment = { id: string; fileName: string; sizeBytes: number | null; createdAt: string };
type ActivityChild = {
  id: string;
  projectId: string;
  parentId: string;
  thirdLevelPlan: string;
  ownerRole: string;
  roleGroup: string;
  responsibleRoleId: string | null;
  assigneeUserId: string | null;
  status: string;
  requiresDeliverable: boolean;
  requiresAttachment: boolean;
  requiresNote: boolean;
  deliverableName: string | null;
  deliverableUrl: string | null;
  completionNote: string | null;
  blockerNote: string | null;
  isBlocked: boolean;
  isNotApplicable: boolean;
  notApplicableReason: string | null;
  plannedDueDateOverride: string | null;
  completedAt: string | null;
  updatedAt: string;
  attachments?: ActivityAttachment[];
};

type ActivityParent = {
  id: string;
  projectId: string;
  stage: string;
  projectTaskName: string;
  status: string;
  plannedDueDate: string | null;
  closedAt: string | null;
  progressPercent: number;
  hasBlocked: boolean;
  hasOverdue: boolean;
  sortOrder: number;
  updatedAt: string;
  children: ActivityChild[];
};

type ActivityEvent = {
  id: string;
  projectId: string;
  parentId: string | null;
  childId: string | null;
  actorRole: string | null;
  actionType: string;
  note: string | null;
  createdAt: string;
  actor: { id: string; username: string } | null;
};

type StageGate = {
  id: string;
  stage: string;
  status: string;
  passedAt: string | null;
  conditionReleaseNote: string | null;
  stats: { total: number; open: number; blocked: number };
};

type WorkspaceData = {
  project: Project;
  parents: ActivityParent[];
  events: ActivityEvent[];
};

type RoleContext = {
  workbenchRole: WorkbenchRole;
  position: null | { code: string; name: string; roleGroup: string };
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

const STAGE_ORDER = ['TR1', 'TR2&3', 'TR4', 'TR4A', 'TR5', 'TR6'];

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const todoParam = searchParams.get('todo');
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [roleContext, setRoleContext] = useState<RoleContext | null>(null);
  const [stageGates, setStageGates] = useState<StageGate[]>([]);
  const [canPassStageGate, setCanPassStageGate] = useState(false);
  const [projectTodos, setProjectTodos] = useState<WorkbenchTodo[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [gateNotes, setGateNotes] = useState<Record<string, string>>({});
  const [childDraft, setChildDraft] = useState({
    status: 'not_started',
    deliverableUrl: '',
    completionNote: '',
    blockerNote: '',
    isBlocked: false,
    plannedDueDateOverride: '',
    isNotApplicable: false,
    notApplicableReason: '',
    returnReason: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadWorkspace = useCallback(async () => {
    setErrorMsg('');
    try {
      const [activityRes, permissionRes, gateRes, workbenchRes] = await Promise.all([
        fetch(`/api/npq/projects/${id}/activities`, { cache: 'no-store' }),
        fetch(`/api/npq/permissions?projectId=${id}&actions=stage_gate.pass`),
        fetch(`/api/npq/projects/${id}/stage-gates`, { cache: 'no-store' }),
        fetch(`/api/npq/workbench?projectId=${id}`, { cache: 'no-store' }),
      ]);
      if (!activityRes.ok) {
        router.push('/workbench');
        return;
      }
      const activityData = await activityRes.json();
      setWorkspace(activityData);

      if (permissionRes.ok) {
        const permissions = await permissionRes.json();
        setCanPassStageGate(Boolean(permissions['stage_gate.pass']));
      }
      if (gateRes.ok) {
        const gateData = await gateRes.json();
        setStageGates(gateData.gates ?? []);
      }
      if (workbenchRes.ok) {
        const workbenchData = await workbenchRes.json();
        setRoleContext(workbenchData.roleContext ?? null);
        const group = (workbenchData.projectTodos as Array<{ projectId: string; todos: WorkbenchTodo[] }> | undefined)
          ?.find((item) => item.projectId === id);
        setProjectTodos(group?.todos ?? []);
      }
    } catch {
      setErrorMsg('项目工作区加载失败');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWorkspace]);

  useEffect(() => {
    if (!workspace) return;
    const timeoutId = window.setTimeout(() => {
      const resolved = resolveInitialSelection(todoParam, workspace.parents, workspace.project.currentStage);
      setSelection(resolved);
      setExpandedStages(new Set([selectionStage(resolved, workspace.parents) ?? workspace.project.currentStage]));
      const parentId = resolved.kind === 'parent' || resolved.kind === 'child' ? resolved.parentId : null;
      setExpandedParents(parentId ? new Set([parentId]) : new Set());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [todoParam, workspace]);

  const stageGroups = useMemo(() => groupParentsByStage(workspace?.parents ?? []), [workspace]);
  const selectedParent = useMemo(() => {
    if (!workspace || !selection || selection.kind === 'stage') return null;
    return workspace.parents.find((parent) => parent.id === selection.parentId) ?? null;
  }, [workspace, selection]);
  const selectedChild = useMemo(() => {
    if (!selectedParent || !selection || selection.kind !== 'child') return null;
    return selectedParent.children.find((child) => child.id === selection.childId) ?? null;
  }, [selectedParent, selection]);

  useEffect(() => {
    if (!selectedChild) return;
    const timeoutId = window.setTimeout(() => {
      setChildDraft({
        status: selectedChild.status,
        deliverableUrl: selectedChild.deliverableUrl ?? '',
        completionNote: selectedChild.completionNote ?? '',
        blockerNote: selectedChild.blockerNote ?? '',
        isBlocked: selectedChild.isBlocked,
        plannedDueDateOverride: toDateInputValue(selectedChild.plannedDueDateOverride),
        isNotApplicable: selectedChild.isNotApplicable,
        notApplicableReason: selectedChild.notApplicableReason ?? '',
        returnReason: '',
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedChild]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载项目工作区...</div>;
  if (!workspace) return <div className="p-8 text-sm text-red-600">{errorMsg || '项目工作区不可用'}</div>;

  const project = workspace.project;
  const role = roleContext?.workbenchRole ?? 'executor';
  const readonly = role === 'manager' || role === 'admin';
  const allParents = workspace.parents;
  const closedParents = allParents.filter((parent) => parent.status === 'closed').length;
  const totalChildren = allParents.reduce((sum, parent) => sum + parent.children.filter((child) => !child.isNotApplicable).length, 0);
  const completedChildren = allParents.reduce((sum, parent) => (
    sum + parent.children.filter((child) => !child.isNotApplicable && child.status === 'completed').length
  ), 0);
  const overallProgress = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;

  function selectItem(next: Selection) {
    setSelection(next);
    const stage = selectionStage(next, allParents);
    if (stage) setExpandedStages((current) => new Set([...current, stage]));
    if (next.kind === 'parent' || next.kind === 'child') {
      setExpandedParents((current) => new Set([...current, next.parentId]));
    }
  }

  async function patchChild(payload: Record<string, unknown>) {
    if (!selectedChild) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const response = await fetch(`/api/npq/activities/children/${selectedChild.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? '子任务保存失败');
      await loadWorkspace();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '子任务保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function saveChild(status?: string) {
    await patchChild({
      status: status ?? childDraft.status,
      deliverableUrl: childDraft.deliverableUrl || null,
      completionNote: childDraft.completionNote || null,
      blockerNote: childDraft.blockerNote || null,
      isBlocked: childDraft.isBlocked,
      plannedDueDateOverride: childDraft.plannedDueDateOverride || null,
      isNotApplicable: childDraft.isNotApplicable,
      notApplicableReason: childDraft.notApplicableReason || null,
    });
  }

  async function returnChild() {
    if (!childDraft.returnReason.trim()) {
      setErrorMsg('退回子任务需要填写退回原因');
      return;
    }
    await patchChild({ returnReason: childDraft.returnReason });
  }

  async function closeParent(parent: ActivityParent) {
    setSaving(true);
    setErrorMsg('');
    try {
      const response = await fetch(`/api/npq/activities/parents/${parent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? '项目活动关闭失败');
      await loadWorkspace();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '项目活动关闭失败');
    } finally {
      setSaving(false);
    }
  }

  async function passStageGate(stage: string) {
    setSaving(true);
    setErrorMsg('');
    try {
      const response = await fetch(`/api/npq/projects/${id}/stage-gates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, conditionReleaseNote: gateNotes[stage] || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? '阶段门处理失败');
      setGateNotes((current) => ({ ...current, [stage]: '' }));
      await loadWorkspace();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '阶段门处理失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 px-5 py-5 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <button
          onClick={() => router.push('/workbench')}
          className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> 返回个人项目工作台
        </button>

        {errorMsg && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        <header className="rounded-lg border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{project.name}</h1>
              {project.description && <p className="mt-1 text-sm text-slate-500">{project.description}</p>}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <StatusPill label={projectStatusLabel(project.status)} tone={projectStatusTone(project.status)} />
                <StatusPill label={`当前阶段 ${project.currentStage}`} tone="blue" />
                <StatusPill label={`${closedParents}/${allParents.length} 项目活动关闭`} tone="slate" />
                <StatusPill label={`${project.members.length} 成员`} tone="slate" />
              </div>
            </div>
            <div className="flex w-full max-w-lg flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>涉及子任务完成率</span>
                <span>{completedChildren}/{totalChildren} / {overallProgress}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${overallProgress}%` }} />
              </div>
              {role === 'npq' && (
                <div className="flex justify-end">
                  <Link
                    href={`/flows/npq/activities?projectId=${project.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    批量修改
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid min-h-[680px] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold">项目任务树</h2>
              <p className="mt-0.5 text-xs text-slate-500">按阶段、项目活动、子任务展开</p>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-auto p-2">
              {stageGroups.map((group) => {
                const expanded = expandedStages.has(group.stage);
                const gate = stageGates.find((item) => item.stage === group.stage);
                return (
                  <div key={group.stage} className="mb-2">
                    <button
                      type="button"
                      onClick={() => setExpandedStages((current) => toggleSet(current, group.stage))}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span>{group.index}. {group.stage}</span>
                        {group.stage === project.currentStage && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">当前</span>}
                      </span>
                      <span className="text-xs text-slate-500">{group.parents.length} 项目活动</span>
                    </button>

                    {expanded && (
                      <div className="ml-3 border-l border-slate-100 pl-2">
                        <TreeButton
                          selected={selection?.kind === 'stage' && selection.stage === group.stage}
                          onClick={() => selectItem({ kind: 'stage', stage: group.stage })}
                          title={`${group.index}.0 阶段门评审`}
                          meta={`${gateStatusLabel(gate?.status)} / 未关闭 ${gate?.stats.open ?? 0} / 阻塞 ${gate?.stats.blocked ?? 0}`}
                        />

                        {group.parents.map((parent, parentIndex) => {
                          const parentNumber = `${group.index}.${parentIndex + 1}`;
                          const parentExpanded = expandedParents.has(parent.id);
                          const childCount = parent.children.filter((child) => !child.isNotApplicable).length;
                          const completed = parent.children.filter((child) => !child.isNotApplicable && child.status === 'completed').length;
                          return (
                            <div key={parent.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  selectItem({ kind: 'parent', parentId: parent.id });
                                  setExpandedParents((current) => toggleSet(current, parent.id));
                                }}
                                className={`mt-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50 ${
                                  selection?.kind === 'parent' && selection.parentId === parent.id ? 'bg-slate-100' : ''
                                }`}
                              >
                                {parentExpanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{parentNumber} {parent.projectTaskName}</span>
                                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                                    {parentStatusLabel(parent.status)} / {completed}/{childCount} 子任务
                                  </span>
                                </span>
                              </button>

                              {parentExpanded && (
                                <div className="ml-5 space-y-1 border-l border-slate-100 pl-2">
                                  {parent.children.map((child, childIndex) => (
                                    <TreeButton
                                      key={child.id}
                                      selected={selection?.kind === 'child' && selection.childId === child.id}
                                      onClick={() => selectItem({ kind: 'child', parentId: parent.id, childId: child.id })}
                                      title={`${parentNumber}.${childIndex + 1} ${child.thirdLevelPlan}`}
                                      meta={`${childStatusLabel(child.status)} / ${child.ownerRole}${child.isBlocked ? ' / 阻塞' : ''}${child.isNotApplicable ? ' / 不涉及' : ''}`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <main className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold">任务详情</h2>
              <p className="mt-0.5 text-xs text-slate-500">上方是关键信息，中间是提交与动作，下方是留痕记录</p>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {selection?.kind === 'stage' && (
                  <StageDetail
                    stage={selection.stage}
                    gate={stageGates.find((item) => item.stage === selection.stage)}
                    canPass={canPassStageGate && role !== 'admin' && role !== 'manager'}
                    note={gateNotes[selection.stage] ?? ''}
                    saving={saving}
                    onNoteChange={(value) => setGateNotes((current) => ({ ...current, [selection.stage]: value }))}
                    onPass={() => passStageGate(selection.stage)}
                  />
                )}

                {selection?.kind === 'parent' && selectedParent && (
                  <ParentDetail
                    parent={selectedParent}
                    readonly={readonly}
                    canClose={role === 'npq' && selectedParent.status === 'pending_npq_close'}
                    saving={saving}
                    onClose={() => closeParent(selectedParent)}
                  />
                )}

                {selection?.kind === 'child' && selectedParent && selectedChild && (
                  <ChildDetail
                    parent={selectedParent}
                    child={selectedChild}
                    draft={childDraft}
                    readonly={readonly}
                    canReturn={role === 'npq'}
                    saving={saving}
                    onDraftChange={(patch) => setChildDraft((current) => ({ ...current, ...patch }))}
                    onSave={() => saveChild()}
                    onStart={() => saveChild('in_progress')}
                    onComplete={() => saveChild('completed')}
                    onToggleBlock={() => patchChild({ isBlocked: !childDraft.isBlocked, blockerNote: childDraft.blockerNote || null })}
                    onReturn={returnChild}
                  />
                )}

                {!selection && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                    从左侧选择阶段门、项目活动或子任务
                  </div>
                )}
              </div>

              <HistoryPanel
                events={workspace.events}
                parentId={selectedParent?.id ?? null}
                childId={selectedChild?.id ?? null}
                projectTodos={projectTodos}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StageDetail({
  stage,
  gate,
  canPass,
  note,
  saving,
  onNoteChange,
  onPass,
}: {
  stage: string;
  gate?: StageGate;
  canPass: boolean;
  note: string;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onPass: () => void;
}) {
  const needsCondition = (gate?.stats.open ?? 0) > 0 || (gate?.stats.blocked ?? 0) > 0;
  return (
    <section className="space-y-4">
      <DetailHeader
        title={`${stage} 阶段门评审`}
        subtitle={`未关闭 ${gate?.stats.open ?? 0} / 阻塞 ${gate?.stats.blocked ?? 0} / 项目活动 ${gate?.stats.total ?? 0}`}
        status={gateStatusLabel(gate?.status)}
      />
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        disabled={!canPass || gate?.status !== 'pending'}
        className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
        placeholder={needsCondition ? '存在未关闭或阻塞项时，填写条件放行说明' : '可填写评审备注'}
      />
      {gate?.conditionReleaseNote && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">已记录：{gate.conditionReleaseNote}</div>
      )}
      <Button disabled={!canPass || gate?.status !== 'pending' || saving} onClick={onPass}>
        <CheckCircle2 />
        {needsCondition ? '条件放行并进入下一阶段' : '通过并进入下一阶段'}
      </Button>
    </section>
  );
}

function ParentDetail({
  parent,
  readonly,
  canClose,
  saving,
  onClose,
}: {
  parent: ActivityParent;
  readonly: boolean;
  canClose: boolean;
  saving: boolean;
  onClose: () => void;
}) {
  const childCount = parent.children.filter((child) => !child.isNotApplicable).length;
  const completed = parent.children.filter((child) => !child.isNotApplicable && child.status === 'completed').length;
  return (
    <section className="space-y-4">
      <DetailHeader
        title={parent.projectTaskName}
        subtitle={`${parent.stage} / ${completed}/${childCount} 子任务完成 / 计划 ${parent.plannedDueDate ? formatDate(parent.plannedDueDate) : '-'}`}
        status={parentStatusLabel(parent.status)}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile label="完成率" value={`${parent.progressPercent}%`} />
        <InfoTile label="阻塞" value={parent.hasBlocked ? '有阻塞' : '无阻塞'} />
        <InfoTile label="逾期" value={parent.hasOverdue ? '已逾期' : '未逾期'} />
      </div>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="text-sm font-medium">关闭规则</div>
        <p className="mt-1 text-sm text-slate-500">所有涉及子任务完成后，项目活动进入待确认关闭，由 NPQ 最终关闭。</p>
        <Button className="mt-3" disabled={readonly || !canClose || saving} onClick={onClose}>
          <ShieldCheck />
          NPQ 确认关闭
        </Button>
      </div>
      {readonly && <ReadonlyHint />}
    </section>
  );
}

function ChildDetail({
  parent,
  child,
  draft,
  readonly,
  canReturn,
  saving,
  onDraftChange,
  onSave,
  onStart,
  onComplete,
  onToggleBlock,
  onReturn,
}: {
  parent: ActivityParent;
  child: ActivityChild;
  draft: {
    status: string;
    deliverableUrl: string;
    completionNote: string;
    blockerNote: string;
    isBlocked: boolean;
    plannedDueDateOverride: string;
    isNotApplicable: boolean;
    notApplicableReason: string;
    returnReason: string;
  };
  readonly: boolean;
  canReturn: boolean;
  saving: boolean;
  onDraftChange: (patch: Partial<typeof draft>) => void;
  onSave: () => void;
  onStart: () => void;
  onComplete: () => void;
  onToggleBlock: () => void;
  onReturn: () => void;
}) {
  return (
    <section className="space-y-4">
      <DetailHeader
        title={child.thirdLevelPlan}
        subtitle={`${parent.stage} / ${parent.projectTaskName} / 责任角色 ${child.ownerRole} / 计划 ${formatDate(child.plannedDueDateOverride ?? parent.plannedDueDate)}`}
        status={childStatusLabel(child.status)}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile label="提交标准" value={child.requiresDeliverable ? '需要交付件' : '完成说明'} />
        <InfoTile label="交付件" value={child.deliverableName ?? '-'} />
        <InfoTile label="附件" value={`${child.attachments?.length ?? 0} 个`} />
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 p-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-slate-500">交付件链接</span>
          <input
            value={draft.deliverableUrl}
            disabled={readonly}
            onChange={(event) => onDraftChange({ deliverableUrl: event.target.value })}
            className="h-8 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-slate-500">完成说明</span>
          <textarea
            value={draft.completionNote}
            disabled={readonly}
            onChange={(event) => onDraftChange({ completionNote: event.target.value })}
            className="min-h-20 rounded-md border border-slate-200 px-2 py-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-slate-500">计划例外日期</span>
            <input
              type="date"
              value={draft.plannedDueDateOverride}
              disabled={readonly}
              onChange={(event) => onDraftChange({ plannedDueDateOverride: event.target.value })}
              className="h-8 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-slate-500">阻塞说明</span>
            <input
              value={draft.blockerNote}
              disabled={readonly}
              onChange={(event) => onDraftChange({ blockerNote: event.target.value })}
              className="h-8 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isNotApplicable}
            disabled={readonly}
            onChange={(event) => onDraftChange({ isNotApplicable: event.target.checked })}
          />
          不涉及本项目
        </label>
        {draft.isNotApplicable && (
          <input
            value={draft.notApplicableReason}
            disabled={readonly}
            onChange={(event) => onDraftChange({ notApplicableReason: event.target.value })}
            placeholder="不涉及原因"
            className="h-8 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={readonly || saving} onClick={onSave}><Save /> 保存</Button>
        <Button variant="outline" disabled={readonly || saving || child.status === 'completed'} onClick={onStart}><Clock /> 转进行中</Button>
        <Button disabled={readonly || saving} onClick={onComplete}><CheckCircle2 /> 标记完成</Button>
        <Button variant="outline" disabled={readonly || saving} onClick={onToggleBlock}>
          {draft.isBlocked ? '解除阻塞' : '标记阻塞'}
        </Button>
      </div>

      {canReturn && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-orange-700">NPQ 退回原因</span>
            <input
              value={draft.returnReason}
              disabled={saving}
              onChange={(event) => onDraftChange({ returnReason: event.target.value })}
              className="h-8 rounded-md border border-orange-200 bg-white px-2 outline-none focus:border-orange-400"
            />
          </label>
          <Button className="mt-2" variant="outline" disabled={saving} onClick={onReturn}><RotateCcw /> 退回子任务</Button>
        </div>
      )}

      {readonly && <ReadonlyHint />}
    </section>
  );
}

function HistoryPanel({
  events,
  parentId,
  childId,
  projectTodos,
}: {
  events: ActivityEvent[];
  parentId: string | null;
  childId: string | null;
  projectTodos: WorkbenchTodo[];
}) {
  const currentEvents = events.filter((event) => childId ? event.childId === childId : event.parentId === parentId).slice(0, 8);
  const parentEvents = events.filter((event) => event.parentId === parentId && event.childId !== childId).slice(0, 8);
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-slate-200 p-3">
        <div className="text-sm font-semibold">当前任务历史</div>
        <EventList events={currentEvents} />
      </section>
      <section className="rounded-lg border border-slate-200 p-3">
        <div className="text-sm font-semibold">项目活动关键历史</div>
        <EventList events={parentEvents} />
      </section>
      {projectTodos.length > 0 && (
        <section className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-semibold">本项目待处理</div>
          <div className="mt-2 space-y-2">
            {projectTodos.slice(0, 6).map((todo) => (
              <div key={todo.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                <div className="truncate text-xs font-medium">{todo.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500">{todo.stage} / {todo.parentTitle}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function EventList({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <div className="mt-2 text-xs text-slate-500">暂无留痕</div>;
  return (
    <div className="mt-2 space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded-md bg-slate-50 px-2 py-1.5">
          <div className="text-xs font-medium">{eventActionLabel(event.actionType)}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {formatDateTime(event.createdAt)} / {event.actor?.username ?? event.actorRole ?? '系统'}
          </div>
          {event.note && <div className="mt-1 text-xs text-slate-600">{event.note}</div>}
        </div>
      ))}
    </div>
  );
}

function TreeButton({
  selected,
  onClick,
  title,
  meta,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50 ${selected ? 'bg-slate-100' : ''}`}
    >
      <span className="block truncate text-sm">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>
    </button>
  );
}

function DetailHeader({ title, subtitle, status }: { title: string; subtitle: string; status: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <StatusPill label={status} tone="slate" />
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function ReadonlyHint() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
      <Lock className="h-4 w-4" /> 当前角色为只读视图
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tones[tone]}`}>{label}</span>;
}

function resolveInitialSelection(todoId: string | null, parents: ActivityParent[], currentStage: string): Selection {
  if (todoId?.startsWith('child:')) {
    const childId = todoId.slice('child:'.length);
    for (const parent of parents) {
      if (parent.children.some((child) => child.id === childId)) return { kind: 'child', parentId: parent.id, childId };
    }
  }
  if (todoId?.startsWith('parent:')) {
    const parentId = todoId.slice('parent:'.length);
    if (parents.some((parent) => parent.id === parentId)) return { kind: 'parent', parentId };
  }
  if (todoId?.startsWith('stage:')) {
    const stage = todoId.split(':').slice(2).join(':') || currentStage;
    return { kind: 'stage', stage };
  }
  const currentParent = parents.find((parent) => parent.stage === currentStage) ?? parents[0];
  if (!currentParent) return { kind: 'stage', stage: currentStage };
  const firstChild = currentParent.children.find((child) => !child.isNotApplicable);
  return firstChild ? { kind: 'child', parentId: currentParent.id, childId: firstChild.id } : { kind: 'parent', parentId: currentParent.id };
}

function selectionStage(selection: Selection, parents: ActivityParent[]) {
  if (selection.kind === 'stage') return selection.stage;
  return parents.find((parent) => parent.id === selection.parentId)?.stage ?? null;
}

function groupParentsByStage(parents: ActivityParent[]) {
  const map = new Map<string, ActivityParent[]>();
  for (const parent of parents) {
    const group = map.get(parent.stage) ?? [];
    group.push(parent);
    map.set(parent.stage, group);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => stageIndex(a) - stageIndex(b))
    .map(([stage, group]) => ({
      stage,
      index: stageIndex(stage) + 1,
      parents: group.sort((a, b) => a.sortOrder - b.sortOrder),
    }));
}

function stageIndex(stage: string) {
  const index = STAGE_ORDER.indexOf(stage);
  return index >= 0 ? index : STAGE_ORDER.length;
}

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function parentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    pending_npq_close: '待确认关闭',
    closed: '已关闭',
  };
  return labels[status] ?? status;
}

function childStatusLabel(status: string) {
  const labels: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    returned: '已退回',
    completed: '已完成',
  };
  return labels[status] ?? status;
}

function gateStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: '待评审',
    passed: '已通过',
    conditional_release: '条件放行',
  };
  return labels[status ?? 'pending'] ?? '待评审';
}

function projectStatusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'completed') return '已完成';
  if (status === 'paused') return '暂停';
  return status;
}

function projectStatusTone(status: string): 'slate' | 'green' | 'amber' | 'red' {
  if (status === 'active') return 'green';
  if (status === 'paused') return 'amber';
  if (status === 'completed') return 'slate';
  return 'red';
}

function eventActionLabel(action: string) {
  const labels: Record<string, string> = {
    initialize_project_activities: '初始化活动',
    initialize_project_activity_snapshot: '初始化活动快照',
    update_child: '更新子任务',
    return_child: '退回子任务',
    upload_attachment: '上传附件',
    update_parent_plan: '调整项目活动计划',
    close_parent: '关闭项目活动',
    pass_stage_gate: '阶段门通过',
    conditional_release_stage_gate: '阶段门条件放行',
  };
  return labels[action] ?? action;
}

function toDateInputValue(value: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
