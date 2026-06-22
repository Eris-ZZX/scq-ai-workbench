'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Project = { id: string; name: string; status: string; currentStage?: string | null };
type ActivityAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedBy?: { username: string } | null;
};
type ActivityChild = {
  id: string;
  parentId: string;
  thirdLevelPlan: string;
  ownerRole: string;
  roleGroup: string;
  status: string;
  requiresDeliverable: boolean;
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
  plannedStartDate: string | null;
  plannedDueDate: string | null;
  progressPercent: number;
  hasBlocked: boolean;
  hasOverdue: boolean;
  updatedAt: string;
  children: ActivityChild[];
};
type StageGate = {
  id: string;
  stage: string;
  status: string;
  plannedStartDate: string | null;
  plannedDueDate: string | null;
  passedAt: string | null;
};
type ActivityEvent = {
  id: string;
  actionType: string;
  note: string | null;
  createdAt: string;
  actor: { username: string } | null;
};

const STAGES = ['TR1', 'TR2&3', 'TR4', 'TR4A', 'TR5', 'TR6'];
const PARENT_STATUS_LABEL: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  pending_npq_close: '待 NPQ 关闭',
  closed: '已关闭',
};
const CHILD_STATUS_LABEL: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  returned: '已退回',
  completed: '已完成',
};
const STAGE_GATE_STATUS_LABEL: Record<string, string> = {
  not_started: '未开始',
  pending: '待评审',
  passed: '已通过',
  conditional_release: '条件放行',
};
const STATUS_COLOR: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
  pending_npq_close: 'bg-amber-100 text-amber-700',
  pending: 'bg-gray-100 text-gray-700',
  conditional_release: 'bg-blue-100 text-blue-700',
  passed: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-green-100 text-green-700',
};

export default function ActivityTrackingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [parents, setParents] = useState<ActivityParent[]>([]);
  const [stageGates, setStageGates] = useState<StageGate[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set(STAGES));
  const [editMode, setEditMode] = useState(false);
  const [milestoneEditMode, setMilestoneEditMode] = useState(false);
  const [selectedParentIds, setSelectedParentIds] = useState<Set<string>>(new Set());
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set());
  const [editDraft, setEditDraft] = useState({
    childStatus: '',
    plannedStartDate: '',
    plannedDueDate: '',
  });
  const [milestoneDraft, setMilestoneDraft] = useState<Record<string, { plannedStartDate: string; plannedDueDate: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ stage: '', status: '', risk: '', owner: '' });

  const loadActivities = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    try {
    const res = await fetch(`/api/npq/projects/${id}/activities`, { cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '活动数据加载失败');
      return;
    }
    const data = await res.json();
    const nextParents = data.parents ?? [];
    const nextStageGates = data.stageGates ?? [];
    const currentStage = data.project?.currentStage ?? '';
    const fallbackStage = nextParents[0]?.stage ?? nextStageGates[0]?.stage ?? '';
    setParents(nextParents);
    setStageGates(nextStageGates);
    setEvents(data.events ?? []);
    setExpandedStages(new Set([currentStage || fallbackStage].filter(Boolean)));
    setSelectedParentIds(new Set());
    setSelectedChildIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '活动数据加载失败');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
      const res = await fetch('/api/npq/projects');
      if (res.ok) {
        const data = await res.json();
        const requestedProjectId = new URLSearchParams(window.location.search).get('projectId') ?? '';
        setProjects(data);
        const selectedId = data.some((project: Project) => project.id === requestedProjectId)
          ? requestedProjectId
          : data[0]?.id ?? '';
        setProjectId(selectedId);
        if (selectedId) await loadActivities(selectedId);
      }
      } catch (err) {
        setError(err instanceof Error ? err.message : '项目列表加载失败');
      } finally {
      setLoading(false);
      }
    })();
  }, [loadActivities]);

  useEffect(() => {
    if (!projectId) return;
    const reloadCurrentProject = () => {
      void loadActivities(projectId);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') reloadCurrentProject();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'npq:project-activities-updated' || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { projectId?: string };
        if (payload.projectId === projectId) reloadCurrentProject();
      } catch {
        reloadCurrentProject();
      }
    };
    window.addEventListener('focus', reloadCurrentProject);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('focus', reloadCurrentProject);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadActivities, projectId]);

  async function updateParentPlan(parent: ActivityParent, patch: { plannedStartDate?: string; plannedDueDate?: string }) {
    setError('');
    const res = await fetch(`/api/npq/activities/parents/${parent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plannedStartDate: 'plannedStartDate' in patch ? patch.plannedStartDate || null : parent.plannedStartDate,
        plannedDueDate: 'plannedDueDate' in patch ? patch.plannedDueDate || null : parent.plannedDueDate,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '项目活动计划时间保存失败');
      throw new Error(data.error ?? '项目活动计划时间保存失败');
    }
  }

  async function updateStagePlan(stage: string, patch: { plannedStartDate?: string; plannedDueDate?: string }) {
    setError('');
    const gate = stageGates.find((item) => item.stage === stage);
    const res = await fetch(`/api/npq/projects/${projectId}/stage-gates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updatePlan',
        stage,
        plannedStartDate: 'plannedStartDate' in patch ? patch.plannedStartDate || null : gate?.plannedStartDate ?? null,
        plannedDueDate: 'plannedDueDate' in patch ? patch.plannedDueDate || null : gate?.plannedDueDate ?? null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '阶段计划时间保存失败');
      throw new Error(data.error ?? '阶段计划时间保存失败');
    }
  }

  async function updateChildren(payload: { status?: string; plannedDueDateOverride?: string }) {
    const childIds = Array.from(selectedChildIds);
    if (childIds.length === 0) return;
    const res = await fetch(`/api/npq/projects/${projectId}/activities/batch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childIds,
        ...payload,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '批量操作失败');
      throw new Error(data.error ?? '批量操作失败');
    }
  }

  function clearEditSelection() {
    setSelectedParentIds(new Set());
    setSelectedChildIds(new Set());
    setEditDraft({ childStatus: '', plannedStartDate: '', plannedDueDate: '' });
  }

  function cancelEdit() {
    setEditMode(false);
    clearEditSelection();
  }

  function openMilestoneEdit() {
    setMilestoneDraft(buildMilestoneDraft(stageGates, stageOptions));
    setMilestoneEditMode(true);
  }

  function cancelMilestoneEdit() {
    setMilestoneEditMode(false);
    setMilestoneDraft({});
  }

  async function saveMilestones() {
    setSaving(true);
    setError('');
    try {
      for (const stage of stageOptions) {
        const draft = milestoneDraft[stage] ?? { plannedStartDate: '', plannedDueDate: '' };
        await updateStagePlan(stage, {
          plannedStartDate: draft.plannedStartDate,
          plannedDueDate: draft.plannedDueDate,
        });
      }
      setMilestoneEditMode(false);
      setMilestoneDraft({});
      await loadActivities(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '阶段里程碑保存失败');
    } finally {
      setSaving(false);
    }
  }

  function toggleParentSelection(parent: ActivityParent, checked: boolean) {
    setSelectedParentIds((current) => toggleSetValue(current, parent.id, checked));
    setSelectedChildIds((current) => toggleMany(current, parent.children.map((child) => child.id), checked));
  }

  async function saveEditChanges() {
    const parentIds = Array.from(selectedParentIds);
    const childIds = Array.from(selectedChildIds);
    if (parentIds.length + childIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const hasParentPatch = Boolean(editDraft.plannedStartDate || editDraft.plannedDueDate);
      if (hasParentPatch) {
        for (const parentId of parentIds) {
          const parent = parents.find((item) => item.id === parentId);
          if (!parent) continue;
          await updateParentPlan(parent, {
            ...(editDraft.plannedStartDate ? { plannedStartDate: editDraft.plannedStartDate } : {}),
            ...(editDraft.plannedDueDate ? { plannedDueDate: editDraft.plannedDueDate } : {}),
          });
        }
      }
      if (childIds.length > 0 && (editDraft.childStatus || editDraft.plannedDueDate)) {
        await updateChildren({
          status: editDraft.childStatus,
          plannedDueDateOverride: editDraft.plannedDueDate,
        });
      }
      setEditMode(false);
      clearEditSelection();
      await loadActivities(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const owners = useMemo(
    () => Array.from(new Set(parents.flatMap((parent) => parent.children.map((child) => child.ownerRole)))).sort(),
    [parents],
  );
  const currentProject = projects.find((project) => project.id === projectId);
  const currentStage = currentProject?.currentStage ?? '';
  const stageOptions = uniqueStages([
    ...stageGates.map((gate) => gate.stage),
    ...parents.map((parent) => parent.stage),
    currentStage,
    ...STAGES,
  ]);

  const filteredParents = parents.filter((parent) => {
    if (filters.stage && parent.stage !== filters.stage) return false;
    if (filters.status && parent.status !== filters.status) return false;
    if (filters.risk === 'blocked' && !parent.hasBlocked) return false;
    if (filters.risk === 'overdue' && !parent.hasOverdue) return false;
    if (filters.owner && !parent.children.some((child) => child.ownerRole === filters.owner || child.roleGroup === filters.owner)) return false;
    return true;
  });

  const currentStageIndex = stageOptions.indexOf(currentStage);
  const selectedCount = selectedParentIds.size + selectedChildIds.size;
  const grouped = stageOptions.map((stage) => {
    const stageParents = parents.filter((parent) => parent.stage === stage);
    const closedCount = stageParents.filter((parent) => parent.status === 'closed').length;
    const gate = stageGates.find((item) => item.stage === stage) ?? null;
    const stageIndex = stageOptions.indexOf(stage);
    const stageStatus = currentStageIndex >= 0 && stageIndex > currentStageIndex
      ? 'not_started'
      : gate?.status ?? 'pending';
    return {
      stage,
      gate,
      stageStatus,
      parents: filteredParents.filter((parent) => parent.stage === stage),
      stats: {
        total: stageParents.length,
        closed: closedCount,
      },
    };
  }).filter((group) => group.parents.length > 0);
  const backHref = projectId ? `/flows/npq/projects/${projectId}` : '/workbench';

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <a
          href={backHref}
          className="mb-4 flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> 返回项目工作区
        </a>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">计划维护</h1>
            <p className="mt-1 text-sm text-muted-foreground">按阶段筛选并批量维护当前项目的活动子任务、附件、退回和不涉及项。</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="mr-1 h-4 w-4" /> 取消
                </Button>
                <Button onClick={saveEditChanges} disabled={saving || selectedCount === 0}>
                  <Save className="mr-1 h-4 w-4" /> 保存
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => loadActivities(projectId)}>
                  <RefreshCw className="mr-1 h-4 w-4" /> 刷新
                </Button>
                <Button variant="outline" onClick={openMilestoneEdit}>
                  阶段里程碑编辑
                </Button>
                <Button onClick={() => setEditMode(true)}>
                  编辑
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="mb-4 grid gap-3 rounded-md border border-border bg-white p-4 shadow-sm lg:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-medium">项目</span>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                void loadActivities(event.target.value);
              }}
              className="w-full rounded-md border px-3 py-2"
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <FilterSelect label="阶段" value={filters.stage} options={stageOptions} onChange={(value) => setFilters((f) => ({ ...f, stage: value }))} />
          <FilterSelect label="状态" value={filters.status} options={Object.keys(PARENT_STATUS_LABEL)} labels={PARENT_STATUS_LABEL} onChange={(value) => setFilters((f) => ({ ...f, status: value }))} />
          <FilterSelect label="标记" value={filters.risk} options={['blocked', 'overdue']} labels={{ blocked: '阻塞', overdue: '逾期' }} onChange={(value) => setFilters((f) => ({ ...f, risk: value }))} />
          <FilterSelect label="负责人" value={filters.owner} options={owners} onChange={(value) => setFilters((f) => ({ ...f, owner: value }))} />
        </div>

        {editMode && (
          <div className="mb-4 grid gap-3 rounded-md border border-blue-100 bg-blue-50/70 p-3 text-sm lg:grid-cols-[120px_repeat(3,minmax(0,1fr))]">
            <div className="flex flex-col justify-center">
              <span className="font-semibold text-blue-900">编辑中</span>
              <span className="text-xs text-blue-700">已选择 {selectedCount} 项</span>
            </div>
            <EditSelect
              label="子任务状态"
              value={editDraft.childStatus}
              options={Object.keys(CHILD_STATUS_LABEL)}
              labels={CHILD_STATUS_LABEL}
              onChange={(value) => setEditDraft((current) => ({ ...current, childStatus: value }))}
              disabled={selectedChildIds.size === 0}
            />
            <label className="text-xs font-medium text-blue-900">
              <span className="mb-1 block">计划开始</span>
              <input
                type="date"
                value={editDraft.plannedStartDate}
                onChange={(event) => setEditDraft((current) => ({ ...current, plannedStartDate: event.target.value }))}
                className="h-9 w-full rounded-md border bg-white px-2 text-xs"
              />
            </label>
            <label className="text-xs font-medium text-blue-900">
              <span className="mb-1 block">计划完成</span>
              <input
                type="date"
                value={editDraft.plannedDueDate}
                onChange={(event) => setEditDraft((current) => ({ ...current, plannedDueDate: event.target.value }))}
                className="h-9 w-full rounded-md border bg-white px-2 text-xs"
              />
            </label>
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(240px,1.5fr)_105px_105px_105px_118px_118px_105px] border-b bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
            <span>项目任务</span>
            <span>状态</span>
            <span>完成情况</span>
            <span>标记</span>
            <span>计划开始</span>
            <span>计划完成</span>
            <span>最后更新</span>
          </div>

          {grouped.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">暂无匹配活动</div>
          ) : grouped.map((group) => {
            const isStageOpen = expandedStages.has(group.stage);
            return (
              <section key={group.stage}>
                <div className="grid grid-cols-[minmax(240px,1.5fr)_105px_105px_105px_118px_118px_105px] items-center border-b bg-slate-50 px-4 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedStages((current) => toggleSet(current, group.stage))}
                      className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-foreground hover:text-primary"
                      aria-expanded={isStageOpen}
                    >
                      {isStageOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span>{group.stage}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                        {group.parents.length} 项目活动
                      </span>
                    </button>
                  </div>
                  <StatusBadge status={group.stageStatus} labels={STAGE_GATE_STATUS_LABEL} />
                  <span className="text-xs font-medium text-slate-700">{group.stats.closed}/{group.stats.total} 项目活动</span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className="text-xs text-muted-foreground">{formatDate(group.gate?.plannedStartDate ?? null)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(group.gate?.plannedDueDate ?? null)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(group.gate?.passedAt ?? null)}</span>
                </div>
                {isStageOpen && group.parents.map((parent) => {
                  const isOpen = expanded.has(parent.id);
                  const completedChildren = parent.children.filter((child) => child.status === 'completed' || child.isNotApplicable).length;
                  return (
                    <div key={parent.id} className="border-b last:border-b-0">
                      <div className="grid grid-cols-[minmax(240px,1.5fr)_105px_105px_105px_118px_118px_105px] items-center px-4 py-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          {editMode && (
                            <input
                              type="checkbox"
                              checked={selectedParentIds.has(parent.id)}
                              onChange={(event) => toggleParentSelection(parent, event.target.checked)}
                              aria-label={`选择 ${parent.projectTaskName}`}
                            />
                          )}
                          <button
                            onClick={() => setExpanded((current) => toggleSet(current, parent.id))}
                            className="flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                            <span className="truncate">{parent.projectTaskName}</span>
                          </button>
                        </div>
                        <StatusBadge status={parent.status} labels={PARENT_STATUS_LABEL} />
                        <span className="text-xs font-medium text-slate-700">{completedChildren}/{parent.children.length} 子任务</span>
                        <div className="flex gap-1">
                          {parent.hasBlocked && <RiskBadge label="阻塞" tone="red" />}
                          {parent.hasOverdue && <RiskBadge label="逾期" tone="amber" />}
                          {!parent.hasBlocked && !parent.hasOverdue && <span className="text-xs text-muted-foreground">无</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(parent.plannedStartDate)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(parent.plannedDueDate)}</span>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(parent.updatedAt)}
                        </div>
                      </div>
                      {isOpen && (
                        <ChildTable
                          parent={parent}
                          editMode={editMode}
                          selectedIds={selectedChildIds}
                          onSelect={setSelectedChildIds}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className="mt-6 rounded-md border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">最近动态</h2>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded border bg-muted/20 px-3 py-2">
                <span className="font-medium text-foreground">{event.actor?.username ?? '系统'}</span>
                <span className="ml-2">{event.actionType}</span>
                {event.note && <span className="ml-2 text-amber-700">{event.note}</span>}
                <span className="ml-2">{formatDateTime(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {milestoneEditMode && (
        <MilestoneDialog
          draft={milestoneDraft}
          stages={stageOptions}
          projectId={projectId}
          saving={saving}
          onDraftChange={setMilestoneDraft}
          onClose={cancelMilestoneEdit}
          onSave={saveMilestones}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border px-3 py-2">
        <option value="">全部</option>
        {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels: Record<string, string>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-blue-900">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border bg-white px-2 text-xs disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">不修改</option>
        {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function MilestoneDialog({
  draft,
  stages,
  projectId,
  saving,
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: Record<string, { plannedStartDate: string; plannedDueDate: string }>;
  stages: string[];
  projectId: string;
  saving: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<Record<string, { plannedStartDate: string; plannedDueDate: string }>>>;
  onClose: () => void;
  onSave: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'milestone' | 'trial'>('milestone');
  const [trialRows, setTrialRows] = useState<Array<{ id: string; item: string; plannedStartDate: string; plannedDueDate: string; note: string }>>(() => {
    const fallback = [
      { id: 'sample-material-ready', item: '试产物料齐套', plannedStartDate: '', plannedDueDate: '', note: '确认关键物料、包材、治具到位' },
      { id: 'sample-pilot-build', item: '小批量试产', plannedStartDate: '', plannedDueDate: '', note: '验证产线节拍、工艺稳定性和质量问题闭环' },
      { id: 'sample-reliability', item: '试产可靠性验证', plannedStartDate: '', plannedDueDate: '', note: '覆盖关键可靠性和功能验证项目' },
      { id: 'sample-review', item: '试产总结评审', plannedStartDate: '', plannedDueDate: '', note: '输出试产问题清单、风险结论和量产放行建议' },
    ];
    try {
      const saved = window.localStorage.getItem(`npq:trial-plan:${projectId}`);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });
  const [trialSaved, setTrialSaved] = useState(false);

  function updateTrialRow(rowId: string, fields: Partial<(typeof trialRows)[number]>) {
    setTrialRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...fields } : row)));
  }

  function addTrialRow() {
    setTrialRows((current) => [
      ...current,
      {
        id: `trial-${Date.now()}-${current.length}`,
        item: '',
        plannedStartDate: '',
        plannedDueDate: '',
        note: '',
      },
    ]);
  }

  function removeTrialRow(rowId: string) {
    setTrialRows((current) => current.filter((row) => row.id !== rowId));
  }

  function saveTrialRows() {
    window.localStorage.setItem(`npq:trial-plan:${projectId}`, JSON.stringify(trialRows));
    setTrialSaved(true);
    window.setTimeout(() => setTrialSaved(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">项目里程碑编辑</h2>
            <p className="mt-1 text-sm text-slate-500">阶段里程碑用于保存阶段计划；试产计划暂时仅做本页维护草稿，不关联其他数据。</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b px-5 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('milestone')}
              className={`rounded-t-md border px-3 py-2 text-sm font-medium ${activeTab === 'milestone' ? 'border-b-white bg-white text-slate-950' : 'bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              阶段里程碑
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trial')}
              className={`rounded-t-md border px-3 py-2 text-sm font-medium ${activeTab === 'trial' ? 'border-b-white bg-white text-slate-950' : 'bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              试产计划
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {activeTab === 'milestone' ? (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[92px_1fr_1fr] bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>阶段</span>
                <span>计划开始</span>
                <span>计划完成</span>
              </div>
              {stages.map((stage) => (
                <div key={stage} className="grid grid-cols-[92px_1fr_1fr] items-center gap-3 border-t px-3 py-2">
                  <div className="text-sm font-semibold text-slate-950">{stage}</div>
                  <input
                    type="date"
                    value={draft[stage]?.plannedStartDate ?? ''}
                    onChange={(event) => onDraftChange((current) => ({
                      ...current,
                      [stage]: {
                        plannedStartDate: event.target.value,
                        plannedDueDate: current[stage]?.plannedDueDate ?? '',
                      },
                    }))}
                    className="h-8 rounded border px-2 text-xs"
                  />
                  <input
                    type="date"
                    value={draft[stage]?.plannedDueDate ?? ''}
                    onChange={(event) => onDraftChange((current) => ({
                      ...current,
                      [stage]: {
                        plannedStartDate: current[stage]?.plannedStartDate ?? '',
                        plannedDueDate: event.target.value,
                      },
                    }))}
                    className="h-8 rounded border px-2 text-xs"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">试产计划暂不关联其他数据</div>
                <Button variant="outline" size="sm" onClick={addTrialRow} disabled={saving}>
                  + 试产节点
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_1.4fr_56px] bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>试产节点</span>
                <span>计划开始</span>
                <span>计划完成</span>
                <span>备注</span>
                <span>操作</span>
              </div>
              {trialRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_1.4fr_56px] items-center gap-3 border-t px-3 py-2">
                  <input
                    value={row.item}
                    onChange={(event) => updateTrialRow(row.id, { item: event.target.value })}
                    placeholder="填写试产节点"
                    className="h-8 rounded border px-2 text-xs"
                  />
                  <input
                    type="date"
                    value={row.plannedStartDate}
                    onChange={(event) => updateTrialRow(row.id, { plannedStartDate: event.target.value })}
                    className="h-8 rounded border px-2 text-xs"
                  />
                  <input
                    type="date"
                    value={row.plannedDueDate}
                    onChange={(event) => updateTrialRow(row.id, { plannedDueDate: event.target.value })}
                    className="h-8 rounded border px-2 text-xs"
                  />
                  <input
                    value={row.note}
                    onChange={(event) => updateTrialRow(row.id, { note: event.target.value })}
                    placeholder="备注"
                    className="h-8 rounded border px-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeTrialRow(row.id)}
                    disabled={saving}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="删除试产节点"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {trialRows.length === 0 && (
                <div className="border-t px-3 py-8 text-center text-sm text-muted-foreground">
                  暂无试产节点，点击“+ 试产节点”新增。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          {activeTab === 'trial' && trialSaved && <span className="self-center text-xs text-green-700">试产计划已保存到本地</span>}
          {activeTab === 'milestone' ? (
            <Button onClick={onSave} disabled={saving}>
              保存阶段里程碑
            </Button>
          ) : (
            <Button onClick={saveTrialRows} disabled={saving}>
              保存试产计划
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChildTable({
  parent,
  editMode,
  selectedIds,
  onSelect,
}: {
  parent: ActivityParent;
  editMode: boolean;
  selectedIds: Set<string>;
  onSelect: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <div className="bg-slate-50 px-4 pb-4">
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="grid grid-cols-[36px_minmax(260px,1.4fr)_120px_100px_110px_100px_110px] border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span />
          <span>三级计划</span>
          <span>负责人</span>
          <span>状态</span>
          <span>交付件</span>
          <span>标记</span>
          <span>完成时间</span>
        </div>
        {parent.children.map((child) => (
          <div
            key={child.id}
            className="grid grid-cols-[36px_minmax(260px,1.4fr)_120px_100px_110px_100px_110px] items-center border-b px-3 py-2 text-xs last:border-b-0 hover:bg-muted/30"
          >
            {editMode ? (
              <input
                type="checkbox"
                checked={selectedIds.has(child.id)}
                onChange={(event) => onSelect((current) => toggleSetValue(current, child.id, event.target.checked))}
                aria-label={`选择 ${child.thirdLevelPlan}`}
              />
            ) : <span />}
            <span className="truncate font-medium text-foreground">
              {child.thirdLevelPlan}
            </span>
            <span className="truncate text-muted-foreground">{child.ownerRole}</span>
            <StatusBadge status={child.status} labels={CHILD_STATUS_LABEL} />
            <span className={child.requiresDeliverable ? 'text-amber-700' : 'text-muted-foreground'}>
              {child.requiresDeliverable ? `需要 · ${child.attachments?.length ?? 0}` : '说明'}
            </span>
            <span>
              {child.isNotApplicable ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">不涉及</span> :
                child.isBlocked ? <RiskBadge label="阻塞" tone="red" /> : <span className="text-muted-foreground">无</span>}
            </span>
            <span className="text-muted-foreground">{child.completedAt ? formatDate(child.completedAt) : '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <span className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}>{labels[status] ?? status}</span>;
}

function RiskBadge({ label, tone }: { label: string; tone: 'red' | 'amber' }) {
  const cls = tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}><AlertTriangle className="h-3 w-3" />{label}</span>;
}

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toggleSetValue(current: Set<string>, value: string, checked: boolean) {
  const next = new Set(current);
  if (checked) next.add(value);
  else next.delete(value);
  return next;
}

function toggleMany(current: Set<string>, values: string[], checked: boolean) {
  const next = new Set(current);
  for (const value of values) {
    if (checked) next.add(value);
    else next.delete(value);
  }
  return next;
}

function uniqueStages(stages: string[]) {
  const seen = new Set<string>();
  return stages.filter((stage) => {
    const value = stage.trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildMilestoneDraft(stageGates: StageGate[], stages: string[]) {
  return Object.fromEntries(
    stages.map((stage) => {
      const gate = stageGates.find((item) => item.stage === stage);
      return [stage, {
        plannedStartDate: toDateInput(gate?.plannedStartDate ?? null),
        plannedDueDate: toDateInput(gate?.plannedDueDate ?? null),
      }];
    }),
  );
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN');
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
