'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileUp,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Project = { id: string; name: string; status: string };
type ActivityAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedBy?: { displayName: string; username: string } | null;
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
  plannedDueDate: string | null;
  progressPercent: number;
  hasBlocked: boolean;
  hasOverdue: boolean;
  updatedAt: string;
  children: ActivityChild[];
};
type ActivityEvent = {
  id: string;
  actionType: string;
  note: string | null;
  createdAt: string;
  actor: { displayName: string; username: string } | null;
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
const STATUS_COLOR: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
  pending_npq_close: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-green-100 text-green-700',
};

export default function ActivityTrackingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [parents, setParents] = useState<ActivityParent[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedChild, setSelectedChild] = useState<ActivityChild | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set());
  const [batchReason, setBatchReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ stage: '', status: '', risk: '', owner: '' });
  const [draft, setDraft] = useState({
    status: '',
    deliverableUrl: '',
    completionNote: '',
    blockerNote: '',
    isBlocked: false,
    isNotApplicable: false,
    notApplicableReason: '',
    plannedDueDateOverride: '',
    returnReason: '',
  });

  const loadActivities = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    const res = await fetch(`/api/npq/projects/${id}/activities`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '活动数据加载失败');
      return;
    }
    const data = await res.json();
    setParents(data.parents ?? []);
    setEvents(data.events ?? []);
    setSelectedChildIds(new Set());
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/npq/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        const firstId = data[0]?.id ?? '';
        setProjectId(firstId);
        if (firstId) await loadActivities(firstId);
      }
      setLoading(false);
    })();
  }, [loadActivities]);

  function openChild(child: ActivityChild) {
    setSelectedChild(child);
    setDraft({
      status: child.status,
      deliverableUrl: child.deliverableUrl ?? '',
      completionNote: child.completionNote ?? '',
      blockerNote: child.blockerNote ?? '',
      isBlocked: child.isBlocked,
      isNotApplicable: child.isNotApplicable,
      notApplicableReason: child.notApplicableReason ?? '',
      plannedDueDateOverride: toDateInput(child.plannedDueDateOverride),
      returnReason: '',
    });
  }

  async function saveChild(extra?: Partial<typeof draft>) {
    if (!selectedChild) return;
    setSaving(true);
    setError('');
    const payload = { ...draft, ...extra };
    const res = await fetch(`/api/npq/activities/children/${selectedChild.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: payload.status,
        deliverableUrl: payload.deliverableUrl || null,
        completionNote: payload.completionNote || null,
        blockerNote: payload.blockerNote || null,
        isBlocked: payload.isBlocked,
        isNotApplicable: payload.isNotApplicable,
        notApplicableReason: payload.notApplicableReason || null,
        plannedDueDateOverride: payload.plannedDueDateOverride || null,
        returnReason: payload.returnReason || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? '保存失败');
      return;
    }
    await loadActivities(projectId);
    setSelectedChild(data);
    setDraft((current) => ({ ...current, returnReason: '' }));
  }

  async function uploadAttachment(file: File) {
    if (!selectedChild) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/npq/activities/children/${selectedChild.id}/attachments`, {
      method: 'POST',
      body: form,
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '附件上传失败');
      return;
    }
    await reloadSelectedChild(selectedChild.id);
    await loadActivities(projectId);
  }

  async function deleteAttachment(attachmentId: string) {
    if (!selectedChild) return;
    setSaving(true);
    const res = await fetch(`/api/npq/activities/children/${selectedChild.id}/attachments?attachmentId=${attachmentId}`, {
      method: 'DELETE',
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '附件删除失败');
      return;
    }
    await reloadSelectedChild(selectedChild.id);
    await loadActivities(projectId);
  }

  async function reloadSelectedChild(childId: string) {
    const res = await fetch(`/api/npq/activities/children/${childId}`);
    if (res.ok) setSelectedChild(await res.json());
  }

  async function updateParentPlan(parent: ActivityParent, plannedDueDate: string) {
    setError('');
    const res = await fetch(`/api/npq/activities/parents/${parent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plannedDueDate: plannedDueDate || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '母任务计划时间保存失败');
      return;
    }
    void loadActivities(projectId);
  }

  async function closeParent(parent: ActivityParent) {
    setError('');
    const res = await fetch(`/api/npq/activities/parents/${parent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ close: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '母任务关闭失败');
      return;
    }
    void loadActivities(projectId);
  }

  async function batchUpdate(payload: { status?: string; isNotApplicable?: boolean }) {
    const childIds = Array.from(selectedChildIds);
    if (childIds.length === 0) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/npq/projects/${projectId}/activities/batch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childIds,
        ...payload,
        notApplicableReason: payload.isNotApplicable ? batchReason || '本项目不涉及' : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '批量操作失败');
      return;
    }
    setBatchReason('');
    await loadActivities(projectId);
  }

  const owners = useMemo(
    () => Array.from(new Set(parents.flatMap((parent) => parent.children.map((child) => child.ownerRole)))).sort(),
    [parents],
  );

  const filteredParents = parents.filter((parent) => {
    if (filters.stage && parent.stage !== filters.stage) return false;
    if (filters.status && parent.status !== filters.status) return false;
    if (filters.risk === 'blocked' && !parent.hasBlocked) return false;
    if (filters.risk === 'overdue' && !parent.hasOverdue) return false;
    if (filters.owner && !parent.children.some((child) => child.ownerRole === filters.owner || child.roleGroup === filters.owner)) return false;
    return true;
  });

  const grouped = STAGES.map((stage) => ({
    stage,
    parents: filteredParents.filter((parent) => parent.stage === stage),
  })).filter((group) => group.parents.length > 0);

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">新产品导入活动跟踪</h1>
            <p className="mt-1 text-sm text-muted-foreground">按阶段管理母任务，展开后维护责任人子任务、附件、退回和不涉及项。</p>
          </div>
          <Button variant="outline" onClick={() => loadActivities(projectId)}>
            <RefreshCw className="mr-1 h-4 w-4" /> 刷新
          </Button>
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
          <FilterSelect label="阶段" value={filters.stage} options={STAGES} onChange={(value) => setFilters((f) => ({ ...f, stage: value }))} />
          <FilterSelect label="状态" value={filters.status} options={Object.keys(PARENT_STATUS_LABEL)} labels={PARENT_STATUS_LABEL} onChange={(value) => setFilters((f) => ({ ...f, status: value }))} />
          <FilterSelect label="标记" value={filters.risk} options={['blocked', 'overdue']} labels={{ blocked: '阻塞', overdue: '逾期' }} onChange={(value) => setFilters((f) => ({ ...f, risk: value }))} />
          <FilterSelect label="负责人" value={filters.owner} options={owners} onChange={(value) => setFilters((f) => ({ ...f, owner: value }))} />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-3 text-sm shadow-sm">
          <span className="font-medium">已选 {selectedChildIds.size} 项</span>
          <input
            value={batchReason}
            onChange={(event) => setBatchReason(event.target.value)}
            className="h-9 min-w-56 rounded-md border px-3 text-sm"
            placeholder="不涉及原因"
          />
          <Button variant="outline" size="sm" disabled={saving || selectedChildIds.size === 0} onClick={() => batchUpdate({ status: 'in_progress' })}>
            设为进行中
          </Button>
          <Button variant="outline" size="sm" disabled={saving || selectedChildIds.size === 0} onClick={() => batchUpdate({ status: 'completed' })}>
            批量完成
          </Button>
          <Button variant="outline" size="sm" disabled={saving || selectedChildIds.size === 0} onClick={() => batchUpdate({ isNotApplicable: true })}>
            标记不涉及
          </Button>
          <Button variant="outline" size="sm" disabled={saving || selectedChildIds.size === 0} onClick={() => batchUpdate({ isNotApplicable: false, status: 'not_started' })}>
            恢复涉及
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(260px,1.5fr)_120px_120px_120px_130px_120px] border-b bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
            <span>项目任务</span>
            <span>状态</span>
            <span>完成率</span>
            <span>标记</span>
            <span>计划完成</span>
            <span>最后更新</span>
          </div>

          {grouped.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">暂无匹配活动</div>
          ) : grouped.map((group) => (
            <section key={group.stage}>
              <div className="border-b bg-slate-50 px-4 py-2 text-sm font-semibold text-foreground">{group.stage}</div>
              {group.parents.map((parent) => {
                const isOpen = expanded.has(parent.id);
                return (
                  <div key={parent.id} className="border-b last:border-b-0">
                    <div className="grid grid-cols-[minmax(260px,1.5fr)_120px_120px_120px_130px_120px] items-center px-4 py-3 text-sm">
                      <button
                        onClick={() => setExpanded((current) => toggleSet(current, parent.id))}
                        className="flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{parent.projectTaskName}</span>
                      </button>
                      <StatusBadge status={parent.status} labels={PARENT_STATUS_LABEL} />
                      <div className="pr-4">
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${parent.progressPercent}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{parent.progressPercent}%</div>
                      </div>
                      <div className="flex gap-1">
                        {parent.hasBlocked && <RiskBadge label="阻塞" tone="red" />}
                        {parent.hasOverdue && <RiskBadge label="逾期" tone="amber" />}
                        {!parent.hasBlocked && !parent.hasOverdue && <span className="text-xs text-muted-foreground">无</span>}
                      </div>
                      <input
                        type="date"
                        value={toDateInput(parent.plannedDueDate)}
                        onChange={(event) => updateParentPlan(parent, event.target.value)}
                        className="w-28 rounded border px-2 py-1 text-xs"
                      />
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(parent.updatedAt)}</span>
                        {parent.status === 'pending_npq_close' && (
                          <button onClick={() => closeParent(parent)} className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700">
                            关闭
                          </button>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <ChildTable
                        parent={parent}
                        selectedIds={selectedChildIds}
                        onSelect={setSelectedChildIds}
                        onOpenChild={openChild}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">最近动态</h2>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded border bg-muted/20 px-3 py-2">
                <span className="font-medium text-foreground">{event.actor?.displayName ?? '系统'}</span>
                <span className="ml-2">{event.actionType}</span>
                {event.note && <span className="ml-2 text-amber-700">{event.note}</span>}
                <span className="ml-2">{formatDateTime(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedChild && (
        <ActivityDrawer
          child={selectedChild}
          draft={draft}
          saving={saving}
          onDraftChange={setDraft}
          onClose={() => setSelectedChild(null)}
          onSave={saveChild}
          onUpload={uploadAttachment}
          onDeleteAttachment={deleteAttachment}
        />
      )}
    </div>
  );
}

function ActivityDrawer({
  child,
  draft,
  saving,
  onDraftChange,
  onClose,
  onSave,
  onUpload,
  onDeleteAttachment,
}: {
  child: ActivityChild;
  draft: {
    status: string;
    deliverableUrl: string;
    completionNote: string;
    blockerNote: string;
    isBlocked: boolean;
    isNotApplicable: boolean;
    notApplicableReason: string;
    plannedDueDateOverride: string;
    returnReason: string;
  };
  saving: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<typeof draft>>;
  onClose: () => void;
  onSave: (extra?: Partial<typeof draft>) => void;
  onUpload: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <PanelRightOpen className="h-4 w-4" />
            <span>{child.ownerRole}</span>
            <StatusBadge status={draft.status} labels={CHILD_STATUS_LABEL} />
            {draft.isNotApplicable && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">不涉及</span>}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{child.thirdLevelPlan}</h2>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <label className="block">
          <span className="mb-1 block font-medium">状态</span>
          <select value={draft.status} onChange={(event) => onDraftChange((d) => ({ ...d, status: event.target.value }))} className="w-full rounded-md border px-3 py-2">
            {Object.entries(CHILD_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
          <input
            type="checkbox"
            checked={draft.isNotApplicable}
            onChange={(event) => onDraftChange((d) => ({ ...d, isNotApplicable: event.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">本项目不涉及</span>
            <span className="text-xs text-muted-foreground">不涉及任务不进入完成率、逾期、阻塞和角色按时率计算。</span>
          </span>
        </label>

        {draft.isNotApplicable && (
          <label className="block">
            <span className="mb-1 block font-medium">不涉及原因</span>
            <textarea value={draft.notApplicableReason} onChange={(event) => onDraftChange((d) => ({ ...d, notApplicableReason: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
          </label>
        )}

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">提交标准</div>
          <div className="mt-1">{child.deliverableName || '无需文件型交付件，完成时需填写完成说明。'}</div>
        </div>

        <label className="block">
          <span className="mb-1 block font-medium">交付件链接 / 文件说明</span>
          <textarea value={draft.deliverableUrl} onChange={(event) => onDraftChange((d) => ({ ...d, deliverableUrl: event.target.value }))} className="min-h-20 w-full rounded-md border px-3 py-2" />
        </label>

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">附件</span>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-1 h-4 w-4" /> 上传
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
          {(child.attachments?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">暂无附件</p>
          ) : (
            <div className="space-y-2">
              {child.attachments?.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{attachment.fileName}</div>
                    <div className="text-muted-foreground">{formatSize(attachment.sizeBytes)} · {formatDate(attachment.createdAt)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" href={`/api/npq/attachments/${attachment.id}`} title="下载">
                      <Download className="h-4 w-4" />
                    </a>
                    <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="删除" disabled={saving} onClick={() => onDeleteAttachment(attachment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block font-medium">完成说明或确认备注</span>
          <textarea value={draft.completionNote} onChange={(event) => onDraftChange((d) => ({ ...d, completionNote: event.target.value }))} className="min-h-20 w-full rounded-md border px-3 py-2" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-medium">计划时间例外</span>
            <input type="date" value={draft.plannedDueDateOverride} onChange={(event) => onDraftChange((d) => ({ ...d, plannedDueDateOverride: event.target.value }))} className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={draft.isBlocked} onChange={(event) => onDraftChange((d) => ({ ...d, isBlocked: event.target.checked }))} />
            <span className="font-medium">标记阻塞</span>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block font-medium">阻塞说明</span>
          <textarea value={draft.blockerNote} onChange={(event) => onDraftChange((d) => ({ ...d, blockerNote: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
        </label>

        <label className="block">
          <span className="mb-1 block font-medium">退回原因</span>
          <textarea value={draft.returnReason} onChange={(event) => onDraftChange((d) => ({ ...d, returnReason: event.target.value }))} className="min-h-16 w-full rounded-md border px-3 py-2" />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSave()} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> 保存
          </Button>
          <Button variant="outline" onClick={() => onSave({ returnReason: draft.returnReason || 'NPQ 退回补充' })} disabled={saving}>
            <RotateCcw className="mr-1 h-4 w-4" /> NPQ 退回
          </Button>
          <Button variant="outline" onClick={() => onSave({ status: 'completed' })} disabled={saving}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> 完成
          </Button>
        </div>

        <div className="pt-2">
          <h3 className="mb-2 font-semibold">动态记录</h3>
          <ChildEvents childId={child.id} />
        </div>
      </div>
    </aside>
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

function ChildTable({
  parent,
  selectedIds,
  onSelect,
  onOpenChild,
}: {
  parent: ActivityParent;
  selectedIds: Set<string>;
  onSelect: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenChild: (child: ActivityChild) => void;
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
            <input
              type="checkbox"
              checked={selectedIds.has(child.id)}
              onChange={(event) => onSelect((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(child.id);
                else next.delete(child.id);
                return next;
              })}
              aria-label={`选择 ${child.thirdLevelPlan}`}
            />
            <button onClick={() => onOpenChild(child)} className="truncate text-left font-medium text-foreground hover:text-primary">
              {child.thirdLevelPlan}
            </button>
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

function formatSize(size: number | null) {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function ChildEvents({ childId }: { childId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    fetch(`/api/npq/activities/children/${childId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setEvents(data?.events ?? []));
  }, [childId]);

  if (events.length === 0) return <p className="text-xs text-muted-foreground">暂无动态</p>;
  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded border bg-muted/20 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDateTime(event.createdAt)}</span>
            <span>{event.actor?.displayName ?? '系统'}</span>
          </div>
          <div className="mt-1 font-medium">{event.actionType}</div>
          {event.note && <div className="mt-1 text-amber-700">{event.note}</div>}
        </div>
      ))}
    </div>
  );
}
