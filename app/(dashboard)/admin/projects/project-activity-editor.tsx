'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  ActivityStructureEditor,
  cloneActivityStructure,
  normalizeActivityStructure,
  type ActivityStructureStage,
} from '../templates/activity-structure-editor';

type ProjectActivityChild = {
  id: string;
  thirdLevelPlan: string;
  ownerRole: string;
  requiresDeliverable: boolean;
  deliverableName: string | null;
  sortOrder: number;
};

type ProjectActivityParent = {
  id: string;
  stage: string;
  projectTaskName: string;
  sortOrder: number;
  children: ProjectActivityChild[];
};

type ProjectActivityStage = {
  id: string;
  stage: string;
};

function actionButton(active = false) {
  return `inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
    active
      ? 'border-ws-blue bg-ws-blue text-white'
      : 'border-border bg-white text-foreground hover:border-ws-blue hover:text-ws-blue'
  }`;
}

function isDraftId(id: string) {
  return id.startsWith('stage-') || id.startsWith('activity-') || id.startsWith('child-');
}

export function toStructure(parents: ProjectActivityParent[], stages: ProjectActivityStage[] = []): ActivityStructureStage[] {
  const stageOrder: string[] = [];
  const stageNames = new Set<string>();
  const groups = new Map<string, ProjectActivityParent[]>();

  for (const stage of stages) {
    if (!stage.stage || stageNames.has(stage.stage)) continue;
    stageNames.add(stage.stage);
    stageOrder.push(stage.stage);
  }

  for (const parent of parents) {
    if (!groups.has(parent.stage)) {
      groups.set(parent.stage, []);
      if (!stageNames.has(parent.stage)) {
        stageNames.add(parent.stage);
        stageOrder.push(parent.stage);
      }
    }
    groups.get(parent.stage)?.push(parent);
  }

  return stageOrder.map((stageName, stageIndex) => ({
    id: `stage:${stageName}`,
    name: stageName,
    sortOrder: stageIndex + 1,
    parents: (groups.get(stageName) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((parent, parentIndex) => ({
        id: parent.id,
        name: parent.projectTaskName,
        description: null,
        closureStandard: null,
        plannedOffsetDays: null,
        sortOrder: parentIndex + 1,
        children: parent.children
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((child, childIndex) => ({
            id: child.id,
            title: child.thirdLevelPlan,
            ownerRoleName: child.ownerRole,
            deliverableName: child.deliverableName,
            requiresDeliverable: child.requiresDeliverable,
            isRequired: true,
            sortOrder: childIndex + 1,
          })),
      })),
  }));
}

function toProjectPayload(stages: ActivityStructureStage[]) {
  return stages.flatMap((stage) => stage.parents.map((parent) => ({
      id: isDraftId(parent.id) ? '' : parent.id,
      stage: stage.name,
      projectTaskName: parent.name,
      sortOrder: parent.sortOrder,
      children: parent.children.map((child) => ({
        id: isDraftId(child.id) ? '' : child.id,
        thirdLevelPlan: child.title,
        ownerRole: child.ownerRoleName,
        requiresDeliverable: child.requiresDeliverable,
        deliverableName: child.deliverableName,
        sortOrder: child.sortOrder,
      })),
    })));
}

function toStagePayload(stages: ActivityStructureStage[]) {
  return stages.map((stage, index) => ({
    stage: stage.name,
    sortOrder: index + 1,
  }));
}

function ProjectActivityEditorView({ projectId }: { projectId: string }) {
  const [stages, setStages] = useState<ActivityStructureStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
    const res = await fetch(`/api/admin/projects/${projectId}/activities`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? '项目活动加载失败');
      return;
    }
    setStages(normalizeActivityStructure(toStructure(data.parents ?? [], data.stages ?? [])));
    setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '项目活动加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const counts = useMemo(() => ({
    parents: stages.reduce((sum, stage) => sum + stage.parents.length, 0),
    children: stages.reduce((sum, stage) => sum + stage.parents.reduce((inner, parent) => inner + parent.children.length, 0), 0),
  }), [stages]);

  function updateStages(nextStages: ActivityStructureStage[]) {
    setStages(normalizeActivityStructure(cloneActivityStructure(nextStages)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/projects/${projectId}/activities`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stages: toStagePayload(stages),
        parents: toProjectPayload(stages),
        changeNote: '后台项目管理维护项目活动结构',
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? '项目活动保存失败');
      return;
    }
    setStages(normalizeActivityStructure(toStructure(data.parents ?? [], data.stages ?? [])));
    window.localStorage.setItem('npq:project-activities-updated', JSON.stringify({
      projectId,
      updatedAt: Date.now(),
    }));
    setDirty(false);
  }

  if (loading) {
    return <section className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">项目活动加载中...</section>;
  }

  return (
    <section className="space-y-3">
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <ActivityStructureEditor
        stages={stages}
        editable
        saving={saving}
        title="项目活动"
        subtitle={`${counts.parents} 项目活动 / ${counts.children} 子任务；当前维护的是项目活动实例，不会同步回模板中心。`}
        headerActions={(
          <>
            {dirty && <span className="text-xs text-amber-700">有未保存修改</span>}
            <button className={actionButton()} onClick={load} disabled={saving}>
              <RefreshCw className="h-4 w-4" />刷新
            </button>
            <button className={actionButton(true)} onClick={save} disabled={saving || !dirty}>
              <Save className="h-4 w-4" />保存
            </button>
          </>
        )}
        onChange={updateStages}
      />
    </section>
  );
}

export const ProjectActivityEditor = memo(ProjectActivityEditorView);
ProjectActivityEditor.displayName = 'ProjectActivityEditor';
