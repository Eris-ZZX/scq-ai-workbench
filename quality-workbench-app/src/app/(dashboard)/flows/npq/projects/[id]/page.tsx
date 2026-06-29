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
      positionRole: { id: string; code: string; name: string; roleName: string | null };
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
  sortOrder: number;
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
  userId: string;
  username: string;
  appRole: string;
  workbenchRole: WorkbenchRole;
  position: null | { id: string; code: string; name: string; roleName: string | null };
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
  const [showInProgressOnly, setShowInProgressOnly] = useState(true);

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
      const visibleParents = filterInProgressParents(workspace.parents, true, roleContext, projectRole, assignedRole);
      const resolved = resolveInitialSelection(todoParam, visibleParents, workspace.project.currentStage);
      setSelection(resolved);
      setExpandedStages(new Set([selectionStage(resolved, visibleParents) ?? workspace.project.currentStage]));
      const parentId = resolved.kind === 'parent' || resolved.kind === 'child' ? resolved.parentId : null;
      setExpandedParents(parentId ? new Set([parentId]) : new Set());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [roleContext, todoParam, workspace]);

  useEffect(() => {
    if (!selection) return;
    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(selectionTreeTargetId(selection));
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [selection, expandedStages, expandedParents]);

  const projectRole = useMemo(() => {
    const member = (workspace?.project.members as any)?.find((m: any) => m.userId === roleContext?.userId);
    return member?.role ?? 'member';
  }, [workspace, roleContext]);

  const assignedRole = useMemo(() => {
    const member = (workspace?.project.members as any)?.find((m: any) => m.userId === roleContext?.userId);
    return member?.assignedRole ?? null;
  }, [workspace, roleContext]);

  const visibleParents = useMemo(
    () => filterInProgressParents(workspace?.parents ?? [], showInProgressOnly, roleContext, projectRole, assignedRole),
    [roleContext, showInProgressOnly, workspace, projectRole, assignedRole],
  );
  const stageGroups = useMemo(() => groupParentsByStage(visibleParents), [visibleParents]);
  const taskNumbers = useMemo(
    () => buildTaskNumberMap(workspace?.parents ?? []),
    [workspace],
  );
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
  const readonly = projectRole === 'observer';
  const allParents = workspace.parents;
  const closedParents = allParents.filter((parent) => parent.status === 'closed').length;
  const totalChildren = allParents.reduce((sum, parent) => sum + parent.children.length, 0);
  const completedChildren = allParents.reduce((sum, parent) => (
    sum + parent.children.filter(isChildEffectivelyCompleted).length
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
      if (!response.ok) throw new Error(body.error ?? '过点处理失败');
      setGateNotes((current) => ({ ...current, [stage]: '' }));
      await loadWorkspace();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '过点处理失败');
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
                <span>子任务完成率</span>
                <span>{completedChildren}/{totalChildren} / {overallProgress}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${overallProgress}%` }} />
              </div>
              {projectRole === 'owner' && (
                <div className="flex justify-end">
                  <Link
                    href={`/flows/npq/activities?projectId=${project.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    计划维护
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 gap-4 xl:min-h-[680px] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white xl:min-h-[680px]">
            <div className="relative border-b border-slate-100 px-4 py-3 pr-28">
              <label className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 text-xs font-medium text-slate-600">
                <span>待处理</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showInProgressOnly}
                  onClick={() => setShowInProgressOnly((current) => !current)}
                  className={`relative h-5 w-9 rounded-full transition ${
                    showInProgressOnly ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                      showInProgressOnly ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
              <h2 className="text-base font-semibold">项目任务树</h2>
              <p className="mt-0.5 text-xs text-slate-500">按阶段、项目活动、子任务展开</p>
            </div>
            <div className="max-h-[42vh] flex-1 overflow-auto p-2 xl:max-h-[calc(100vh-180px)]">
              {stageGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                  当前没有进行中的项目活动或子任务
                </div>
              ) : stageGroups.map((group) => {
                const expanded = expandedStages.has(group.stage);
                const isCurrentStage = group.stage === project.currentStage && project.status !== 'completed' && project.stageGateStatus !== 'completed';
                return (
                  <div key={group.stage} className="mb-2">
                    <div
                      className={`relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-slate-50 ${
                        selection?.kind === 'stage' && selection.stage === group.stage ? 'bg-slate-100' : ''
                      }`}
                    >
                      <button
                        type="button"
                        id={selectionTreeTargetId({ kind: 'stage', stage: group.stage })}
                        onClick={() => setExpandedStages((current) => toggleSet(current, group.stage))}
                        className="absolute inset-0 rounded-md"
                        aria-label={`${expanded ? '收起' : '展开'} ${group.index}. ${group.stage} ${group.parents.length} 项目活动`}
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none relative z-0 flex min-w-0 flex-1 items-center gap-1.5"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{group.index}. {group.stage}</span>
                        {group.stage === project.currentStage && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">当前</span>}
                        <span className="ml-auto shrink-0 text-xs text-slate-500">{group.parents.length} 项目活动</span>
                      </div>
                      {isCurrentStage && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectItem({ kind: 'stage', stage: group.stage });
                          }}
                          className={`relative z-10 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                            selection?.kind === 'stage' && selection.stage === group.stage
                              ? 'bg-blue-700 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          过点
                        </button>
                      )}
                    </div>

                    {expanded && (
                      <div className="ml-3 border-l border-slate-100 pl-2">
                        {group.parents.map((parent) => {
                          const parentNumber = taskNumbers.parents.get(parent.id) ?? `${group.index}.${parent.sortOrder + 1}`;
                          const parentExpanded = expandedParents.has(parent.id);
                          const childCount = parent.children.length;
                          const completed = parent.children.filter(isChildEffectivelyCompleted).length;
                          const parentDisplayStatus = parentDisplayStatusLabel(parent);
                          return (
                            <div key={parent.id}>
                              <button
                                type="button"
                                id={selectionTreeTargetId({ kind: 'parent', parentId: parent.id })}
                                onClick={() => {
                                  setSelection({ kind: 'parent', parentId: parent.id });
                                  setExpandedStages((current) => new Set([...current, group.stage]));
                                  setExpandedParents((current) => toggleSet(current, parent.id));
                                }}
                                className={`mt-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-slate-50 ${
                                  selection?.kind === 'parent' && selection.parentId === parent.id ? 'bg-slate-100 ring-2 ring-blue-200' : ''
                                }`}
                              >
                                {parentExpanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{parentNumber} {parent.projectTaskName}</span>
                                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <StatusBadge label={parentDisplayStatus} tone={parentStatusTone(parent)} />
                                    <span className="text-xs text-slate-500">{completed}/{childCount} 子任务</span>
                                  </span>
                                </span>
                              </button>

                              {parentExpanded && (
                                <div className="ml-5 space-y-1 border-l border-slate-100 pl-2">
                                  {parent.children.map((child) => (
                                    <TreeButton
                                      key={child.id}
                                      selected={selection?.kind === 'child' && selection.childId === child.id}
                                      onClick={() => selectItem({ kind: 'child', parentId: parent.id, childId: child.id })}
                                      targetId={selectionTreeTargetId({ kind: 'child', parentId: parent.id, childId: child.id })}
                                      title={`${taskNumbers.children.get(child.id) ?? `${parentNumber}.${child.sortOrder + 1}`} ${child.thirdLevelPlan}`}
                                      metaNode={<ChildTreeMeta child={child} parentDueDate={parent.plannedDueDate} />}
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

          <main className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold">任务详情</h2>
              <p className="mt-0.5 text-xs text-slate-500">上方是关键信息，中间是提交与动作，下方是留痕记录</p>
            </div>

            <div className="grid gap-4 p-3 sm:p-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {selection?.kind === 'stage' && (
                  <StageDetail
                    stage={selection.stage}
                    gate={stageGates.find((item) => item.stage === selection.stage)}
                    canPass={canPassStageGate && projectRole !== 'observer'}
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
                    canClose={projectRole === 'owner' && isParentReadyToClose(selectedParent)}
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
                    canReturn={projectRole === 'owner'}
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
                    从左侧选择过点、项目活动或子任务
                  </div>
                )}
              </div>

              <HistoryPanel
                events={workspace.events}
                parentId={selectedParent?.id ?? null}
                childId={selectedChild?.id ?? null}
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
    <section className="min-w-0 space-y-4">
      <DetailHeader
        title={`${stage} 过点评审`}
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
  const childCount = parent.children.length;
  const completed = parent.children.filter(isChildEffectivelyCompleted).length;
  const progressPercent = childCount > 0 ? Math.round((completed / childCount) * 100) : 0;
  return (
    <section className="space-y-4">
      <DetailHeader
        title={parent.projectTaskName}
        subtitle={`${parent.stage} / ${completed}/${childCount} 子任务完成 / 计划 ${parent.plannedDueDate ? formatDate(parent.plannedDueDate) : '-'}`}
        status={parentDisplayStatusLabel(parent)}
        statusTone={parentStatusTone(parent)}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="完成率" value={`${progressPercent}%`} />
        <InfoTile label="阻塞" value={parent.hasBlocked ? '有阻塞' : '无阻塞'} />
        <InfoTile label="逾期" value={parent.hasOverdue ? '已逾期' : '未逾期'} />
      </div>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="text-sm font-medium">关闭规则</div>
        <p className="mt-1 text-sm text-slate-500">所有子任务完成或标记不涉及后，项目活动进入待确认关闭，由 NPQ 最终关闭。</p>
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
    <section className="min-w-0 space-y-4">
      <DetailHeader
        title={child.thirdLevelPlan}
        subtitle={`${parent.stage} / ${parent.projectTaskName} / 责任角色 ${child.ownerRole} / 计划 ${formatDate(child.plannedDueDateOverride ?? parent.plannedDueDate)}`}
        status={childDisplayStatusLabel(child)}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="提交标准" value={child.requiresDeliverable ? '需要交付件' : '完成说明'} />
        <InfoTile label="交付件" value={child.deliverableName ?? '-'} />
        <InfoTile label="附件" value={`${child.attachments?.length ?? 0} 个`} />
      </div>

      <div className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-slate-500">交付件链接</span>
          <input
            value={draft.deliverableUrl}
            disabled={readonly}
            onChange={(event) => onDraftChange({ deliverableUrl: event.target.value })}
            className="h-8 min-w-0 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-slate-500">完成说明</span>
          <textarea
            value={draft.completionNote}
            disabled={readonly}
            onChange={(event) => onDraftChange({ completionNote: event.target.value })}
            className="min-h-20 min-w-0 rounded-md border border-slate-200 px-2 py-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-slate-500">计划例外日期</span>
            <input
              type="date"
              value={draft.plannedDueDateOverride}
              disabled={readonly}
              onChange={(event) => onDraftChange({ plannedDueDateOverride: event.target.value })}
              className="h-8 min-w-0 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-slate-500">阻塞说明</span>
            <input
              value={draft.blockerNote}
              disabled={readonly}
              onChange={(event) => onDraftChange({ blockerNote: event.target.value })}
              className="h-8 min-w-0 rounded-md border border-slate-200 px-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
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
            className="h-8 min-w-0 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>button]:justify-center">
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
}: {
  events: ActivityEvent[];
  parentId: string | null;
  childId: string | null;
}) {
  const childEvents = childId ? events.filter((event) => event.childId === childId).slice(0, 8) : [];
  const parentEvents = parentId ? events.filter((event) => event.parentId === parentId && !event.childId).slice(0, 8) : [];
  const primaryTitle = childId ? '子任务历史' : '项目活动历史';
  const primaryEvents = childId ? childEvents : parentEvents;
  return (
    <aside className="grid min-w-0 gap-3 md:grid-cols-2 2xl:block 2xl:space-y-4">
      <section className="rounded-lg border border-slate-200 p-3">
        <div className="text-sm font-semibold">{primaryTitle}</div>
        <EventList events={primaryEvents} />
      </section>
      {childId && parentId && (
        <section className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-semibold">项目活动历史</div>
          <EventList events={parentEvents} />
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
  targetId,
  title,
  meta,
  metaNode,
}: {
  selected: boolean;
  onClick: () => void;
  targetId?: string;
  title: string;
  meta?: string;
  metaNode?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      id={targetId}
      onClick={onClick}
      className={`mt-1 w-full rounded-md px-2 py-1.5 text-left outline-none hover:bg-slate-50 ${selected ? 'bg-slate-100 ring-2 ring-blue-200' : ''}`}
    >
      <span className="block truncate text-sm">{title}</span>
      {metaNode ?? <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>}
    </button>
  );
}

function ChildTreeMeta({ child, parentDueDate }: { child: ActivityChild; parentDueDate: string | null }) {
  const overdue = isChildOverdue(child, parentDueDate);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <StatusBadge label={childDisplayStatusLabel(child)} tone={child.isNotApplicable ? 'slate' : childStatusTone(child.status)} />
      <span className="text-xs text-slate-500">{child.ownerRole}</span>
      {overdue && <StatusBadge label="延期" tone="red" />}
      {child.isBlocked && <StatusBadge label="阻塞" tone="red" />}
    </span>
  );
}

function DetailHeader({
  title,
  subtitle,
  status,
  statusTone = 'slate',
}: {
  title: string;
  subtitle: string;
  status: string;
  statusTone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold leading-snug sm:text-lg">{title}</h3>
          <p className="mt-1 break-words text-sm leading-5 text-slate-500">{subtitle}</p>
        </div>
        <div className="shrink-0">
          <StatusBadge label={status} tone={statusTone} />
        </div>
      </div>
    </div>
  );
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

function isChildEffectivelyCompleted(child: Pick<ActivityChild, 'status' | 'isNotApplicable'>) {
  return child.status === 'completed' || child.isNotApplicable;
}

function isParentReadyToClose(parent: ActivityParent) {
  return parent.status !== 'closed' && parent.children.length > 0 && parent.children.every(isChildEffectivelyCompleted);
}

function parentDisplayStatusLabel(parent: ActivityParent) {
  return isParentReadyToClose(parent) ? parentStatusLabel('pending_npq_close') : parentStatusLabel(parent.status);
}

function parentStatusTone(parent: ActivityParent): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  if (isParentReadyToClose(parent)) return 'amber';
  if (parent.status === 'closed') return 'green';
  if (parent.status === 'in_progress') return 'blue';
  if (parent.hasBlocked || parent.hasOverdue) return 'red';
  return 'slate';
}

function childDisplayStatusLabel(child: Pick<ActivityChild, 'status' | 'isNotApplicable'>) {
  return child.isNotApplicable ? '不涉及' : childStatusLabel(child.status);
}

function childStatusTone(status: string): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  if (status === 'in_progress') return 'blue';
  if (status === 'completed') return 'green';
  if (status === 'returned') return 'amber';
  return 'slate';
}

function isChildOverdue(child: ActivityChild, parentDueDate: string | null) {
  if (child.status === 'completed' || child.isNotApplicable) return false;
  const due = child.plannedDueDateOverride ?? parentDueDate;
  return Boolean(due && new Date(due).getTime() < Date.now());
}

function StatusBadge({ label, tone }: { label: string; tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold leading-none ${tones[tone]}`}>
      {label}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
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

function selectionTreeTargetId(selection: Selection) {
  if (selection.kind === 'stage') return `tree-stage-${selection.stage}`;
  if (selection.kind === 'parent') return `tree-parent-${selection.parentId}`;
  return `tree-child-${selection.childId}`;
}

function filterInProgressParents(parents: ActivityParent[], enabled: boolean, roleContext: RoleContext | null, projectRole: string, assignedRole: string | null) {
  if (!enabled) return parents;
  const isOwner = projectRole === 'owner';
  return parents
    .map((parent) => {
      const includeAll = isOwner && isParentInCloseReview(parent);
      const children = includeAll
        ? parent.children
        : parent.children.filter((child) => isChildVisibleInAttentionFilter(child, parent.plannedDueDate, roleContext, assignedRole));
      return {
        parent: { ...parent, children },
        visible: isParentVisibleInAttentionFilter(parent, children.length, isOwner),
      };
    })
    .filter((item) => item.visible)
    .map((item) => item.parent);
}

function isChildVisibleInAttentionFilter(child: ActivityChild, parentDueDate: string | null, roleContext: RoleContext | null, assignedRole: string | null) {
  if (isChildEffectivelyCompleted(child)) return false;
  if (!isChildOwnedByRoleContext(child, roleContext, assignedRole)) return false;
  return child.status === 'in_progress'
    || child.status === 'returned'
    || child.isBlocked
    || isChildOverdue(child, parentDueDate);
}

function isParentVisibleInAttentionFilter(parent: ActivityParent, visibleChildCount: number, isOwner: boolean) {
  if (!isOwner) return visibleChildCount > 0;
  return isParentInCloseReview(parent)
    || parent.hasBlocked
    || parent.hasOverdue
    || visibleChildCount > 0;
}

function isParentInCloseReview(parent: ActivityParent) {
  return isParentReadyToClose(parent) || parent.status === 'pending_npq_close';
}

function isChildOwnedByRoleContext(child: ActivityChild, roleContext: RoleContext | null, assignedRole: string | null) {
  if (!roleContext) return true;
  if (child.assigneeUserId && child.assigneeUserId === roleContext.userId) return true;
  // 项目内分配的角色匹配子活动的 ownerRole
  if (assignedRole && assignedRole === child.ownerRole) return true;
  return false;
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

function buildTaskNumberMap(parents: ActivityParent[]) {
  const parentNumbers = new Map<string, string>();
  const childNumbers = new Map<string, string>();
  const groups = groupParentsByStage(parents);
  for (const group of groups) {
    group.parents.forEach((parent, parentIndex) => {
      const parentNumber = `${group.index}.${parentIndex + 1}`;
      parentNumbers.set(parent.id, parentNumber);
      parent.children
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach((child, childIndex) => {
          childNumbers.set(child.id, `${parentNumber}.${childIndex + 1}`);
        });
    });
  }
  return { parents: parentNumbers, children: childNumbers };
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
    activate_stage_activities: '进入阶段',
    pass_stage_gate: '过点通过',
    conditional_release_stage_gate: '过点条件放行',
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
