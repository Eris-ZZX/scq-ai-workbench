'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Edit3, Layers3, Trash2, X } from 'lucide-react';

export type ActivityStructureChild = {
  id: string;
  title: string;
  ownerRoleName: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  isRequired: boolean;
  sortOrder: number;
};

export type ActivityStructureParent = {
  id: string;
  name: string;
  description: string | null;
  closureStandard: string | null;
  plannedStartOffsetDays?: number | null;
  plannedOffsetDays: number | null;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
  sortOrder: number;
  children: ActivityStructureChild[];
};

export type ActivityStructureStage = {
  id: string;
  name: string;
  plannedStartOffsetDays?: number | null;
  plannedDueOffsetDays?: number | null;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
  sortOrder: number;
  parents: ActivityStructureParent[];
};

type TemplateItemDialog =
  | { kind: 'stage'; mode: 'create' | 'edit'; stageId?: string; name: string; plannedStartDate: string; plannedDueDate: string }
  | { kind: 'parent'; mode: 'create' | 'edit'; stageId: string; parentId?: string; name: string; plannedStartDate: string; plannedDueDate: string }
  | {
      kind: 'child';
      mode: 'create' | 'edit';
      stageId: string;
      parentId: string;
      childId?: string;
      title: string;
      ownerRoleName: string;
      deliverableName: string;
      requiresDeliverable: boolean;
    };

type ProjectRoleOption = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

const fallbackRoleOptions: ProjectRoleOption[] = ['NPQ', 'PQE', 'SQE', 'FAE', 'RAM', 'QCM'].map((role, index) => ({
  id: role,
  code: role,
  name: role,
  sortOrder: index + 1,
}));

function iconButtonClass(active = false) {
  return `inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-xs transition ${
    active
      ? 'border-ws-blue bg-ws-blue text-white'
      : 'border-border bg-white text-foreground hover:border-ws-blue hover:text-ws-blue'
  }`;
}

function dangerButtonClass() {
  return 'inline-flex h-8 shrink-0 items-center gap-1 rounded border border-red-200 bg-white px-2 text-xs text-red-700 transition hover:border-red-600 hover:text-red-800';
}

function fieldClass(extra = '') {
  return `rounded border border-border px-2 text-sm text-foreground ${extra}`;
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function reorderById<T extends { id: string; sortOrder: number }>(items: T[], itemId: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const next = [...items];
  const currentItem = next[index]!;
  next[index] = next[nextIndex]!;
  next[nextIndex] = currentItem;
  return next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }));
}

export function cloneActivityStructure(stages: ActivityStructureStage[]): ActivityStructureStage[] {
  return stages.map((stage) => ({
    ...stage,
    parents: stage.parents.map((parent) => ({
      ...parent,
      children: parent.children.map((child) => ({ ...child })),
    })),
  }));
}

export function ActivityStructureEditor({
  stages,
  editable,
  saving,
  title = '活动模板',
  subtitle,
  headerActions,
  planMode = 'none',
  onChange,
}: {
  stages: ActivityStructureStage[];
  editable: boolean;
  saving?: boolean;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  planMode?: 'none' | 'date';
  onChange: (stages: ActivityStructureStage[]) => void;
}) {
  const [itemDialog, setItemDialog] = useState<TemplateItemDialog | null>(null);
  const [projectRoles, setProjectRoles] = useState<ProjectRoleOption[]>(fallbackRoleOptions);
  const roleOptions = useMemo(
    () => projectRoles.map((role) => ({
      value: role.code,
      label: role.name,
    })),
    [projectRoles],
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/npq/project-roles')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProjectRoleOption[] | null) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setProjectRoles(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function updateStages(updater: (current: ActivityStructureStage[]) => ActivityStructureStage[]) {
    onChange(updater(stages));
  }

  function updateStage(stageId: string, fields: Partial<Pick<ActivityStructureStage, 'name' | 'plannedStartDate' | 'plannedDueDate'>>) {
    updateStages((current) => current.map((stage) => (stage.id === stageId ? { ...stage, ...fields } : stage)));
  }

  function openCreateStage() {
    setItemDialog({ kind: 'stage', mode: 'create', name: '新阶段', plannedStartDate: '', plannedDueDate: '' });
  }

  function openEditStage(stage: ActivityStructureStage) {
    setItemDialog({
      kind: 'stage',
      mode: 'edit',
      stageId: stage.id,
      name: stage.name,
      plannedStartDate: toDateInput(stage.plannedStartDate ?? null),
      plannedDueDate: toDateInput(stage.plannedDueDate ?? null),
    });
  }

  function removeStage(stageId: string) {
    updateStages((current) => current.filter((stage) => stage.id !== stageId));
  }

  function moveStage(stageId: string, direction: -1 | 1) {
    updateStages((current) => reorderById(current, stageId, direction));
  }

  function updateParent(stageId: string, parentId: string, fields: Partial<Pick<ActivityStructureParent, 'name' | 'plannedStartDate' | 'plannedDueDate'>>) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? { ...stage, parents: stage.parents.map((parent) => (parent.id === parentId ? { ...parent, ...fields } : parent)) }
      : stage));
  }

  function openCreateParent(stageId: string) {
    setItemDialog({ kind: 'parent', mode: 'create', stageId, name: '新项目活动', plannedStartDate: '', plannedDueDate: '' });
  }

  function openEditParent(stageId: string, parent: ActivityStructureParent) {
    setItemDialog({
      kind: 'parent',
      mode: 'edit',
      stageId,
      parentId: parent.id,
      name: parent.name,
      plannedStartDate: toDateInput(parent.plannedStartDate ?? null),
      plannedDueDate: toDateInput(parent.plannedDueDate ?? null),
    });
  }

  function removeParent(stageId: string, parentId: string) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? { ...stage, parents: stage.parents.filter((parent) => parent.id !== parentId) }
      : stage));
  }

  function moveParent(stageId: string, parentId: string, direction: -1 | 1) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? { ...stage, parents: reorderById(stage.parents, parentId, direction) }
      : stage));
  }

  function updateChild(stageId: string, parentId: string, childId: string, fields: Partial<ActivityStructureChild>) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? {
        ...stage,
        parents: stage.parents.map((parent) => parent.id === parentId
          ? { ...parent, children: parent.children.map((child) => (child.id === childId ? { ...child, ...fields } : child)) }
          : parent),
      }
      : stage));
  }

  function openCreateChild(stageId: string, parentId: string) {
    setItemDialog({
      kind: 'child',
      mode: 'create',
      stageId,
      parentId,
      title: '新子任务',
      ownerRoleName: 'NPQ',
      deliverableName: '',
      requiresDeliverable: false,
    });
  }

  function openEditChild(stageId: string, parentId: string, child: ActivityStructureChild) {
    setItemDialog({
      kind: 'child',
      mode: 'edit',
      stageId,
      parentId,
      childId: child.id,
      title: child.title,
      ownerRoleName: child.ownerRoleName,
      deliverableName: child.deliverableName ?? '',
      requiresDeliverable: child.requiresDeliverable,
    });
  }

  function removeChild(stageId: string, parentId: string, childId: string) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? {
        ...stage,
        parents: stage.parents.map((parent) => parent.id === parentId
          ? { ...parent, children: parent.children.filter((child) => child.id !== childId) }
          : parent),
      }
      : stage));
  }

  function moveChild(stageId: string, parentId: string, childId: string, direction: -1 | 1) {
    updateStages((current) => current.map((stage) => stage.id === stageId
      ? {
        ...stage,
        parents: stage.parents.map((parent) => parent.id === parentId
          ? { ...parent, children: reorderById(parent.children, childId, direction) }
          : parent),
      }
      : stage));
  }

  function submitItemDialog() {
    if (!itemDialog) return;

    if (itemDialog.kind === 'stage') {
      const name = itemDialog.name.trim();
      if (!name) {
        window.alert('阶段名称不能为空');
        return;
      }
      if (itemDialog.mode === 'edit' && itemDialog.stageId) {
        updateStage(itemDialog.stageId, {
          name,
          ...(planMode === 'date' ? { plannedStartDate: itemDialog.plannedStartDate || null, plannedDueDate: itemDialog.plannedDueDate || null } : {}),
        });
      } else {
        updateStages((current) => [
          ...current,
          {
            id: newId('stage'),
            name,
            plannedStartDate: planMode === 'date' ? itemDialog.plannedStartDate || null : null,
            plannedDueDate: planMode === 'date' ? itemDialog.plannedDueDate || null : null,
            sortOrder: current.length + 1,
            parents: [],
          },
        ]);
      }
      setItemDialog(null);
      return;
    }

    if (itemDialog.kind === 'parent') {
      const name = itemDialog.name.trim();
      if (!name) {
        window.alert('项目活动名称不能为空');
        return;
      }
      if (itemDialog.mode === 'edit' && itemDialog.parentId) {
        updateParent(itemDialog.stageId, itemDialog.parentId, {
          name,
          ...(planMode === 'date' ? { plannedStartDate: itemDialog.plannedStartDate || null, plannedDueDate: itemDialog.plannedDueDate || null } : {}),
        });
      } else {
        updateStages((current) => current.map((stage) => stage.id === itemDialog.stageId
          ? {
            ...stage,
            parents: [
              ...stage.parents,
              {
                id: newId('activity'),
                name,
                description: null,
                closureStandard: null,
                plannedStartDate: planMode === 'date' ? itemDialog.plannedStartDate || null : null,
                plannedDueDate: planMode === 'date' ? itemDialog.plannedDueDate || null : null,
                plannedOffsetDays: null,
                sortOrder: stage.parents.length + 1,
                children: [],
              },
            ],
          }
          : stage));
      }
      setItemDialog(null);
      return;
    }

    const title = itemDialog.title.trim();
    if (!title) {
      window.alert('子任务名称不能为空');
      return;
    }
    const fields = {
      title,
      ownerRoleName: itemDialog.ownerRoleName,
      deliverableName: itemDialog.deliverableName.trim() || null,
      requiresDeliverable: itemDialog.requiresDeliverable,
    };
    if (itemDialog.mode === 'edit' && itemDialog.childId) {
      updateChild(itemDialog.stageId, itemDialog.parentId, itemDialog.childId, fields);
    } else {
      updateStages((current) => current.map((stage) => stage.id === itemDialog.stageId
        ? {
          ...stage,
          parents: stage.parents.map((parent) => parent.id === itemDialog.parentId
            ? {
              ...parent,
              children: [
                ...parent.children,
                {
                  id: newId('child'),
                  title: fields.title,
                  ownerRoleName: fields.ownerRoleName,
                  deliverableName: fields.deliverableName,
                  requiresDeliverable: fields.requiresDeliverable,
                  isRequired: true,
                  sortOrder: parent.children.length + 1,
                },
              ],
            }
            : parent),
        }
        : stage));
    }
    setItemDialog(null);
  }

  return (
    <main className="min-w-0 rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{subtitle ?? '-'}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerActions}
          {editable && (
            <button className={iconButtonClass()} onClick={openCreateStage} disabled={saving} title="新增阶段">
              +阶段
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[calc(100vh-170px)] overflow-auto p-4">
        <div className="space-y-3">
          {stages.map((stage, stageIndex) => (
            <details key={stage.id} className="rounded-lg border border-border bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <Layers3 className="h-4 w-4 shrink-0 text-ws-blue" />
                  <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground">{stageIndex + 1}</span>
                  <span className="truncate text-sm font-semibold text-foreground">{stage.name}</span>
                  {planMode === 'date' && (
                    <span className="shrink-0 text-xs text-muted-foreground">{formatPlanRange(stage.plannedStartDate, stage.plannedDueDate)}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{stage.parents.length} 项目活动</span>
                </div>
                {editable && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      className={iconButtonClass()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        moveStage(stage.id, -1);
                      }}
                      disabled={saving || stageIndex === 0}
                      title="上移阶段"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      className={iconButtonClass()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        moveStage(stage.id, 1);
                      }}
                      disabled={saving || stageIndex === stages.length - 1}
                      title="下移阶段"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className={iconButtonClass()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openCreateParent(stage.id);
                      }}
                      disabled={saving}
                      title="新增项目活动"
                    >
                      +项目活动
                    </button>
                    <button
                      className={iconButtonClass()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openEditStage(stage);
                      }}
                      title="编辑阶段"
                    >
                      <Edit3 className="h-4 w-4" />编辑
                    </button>
                    <button
                      className={dangerButtonClass()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeStage(stage.id);
                      }}
                      title="删除阶段"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </summary>

              <div className="space-y-3 border-t border-border p-3">
                <div className="space-y-2">
                  {stage.parents.map((parent, parentIndex) => (
                    <details key={parent.id} className="rounded border border-border bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-muted-foreground">{stageIndex + 1}.{parentIndex + 1}</span>
                          <span className="truncate text-sm font-medium">{parent.name}</span>
                          {planMode === 'date' && (
                            <span className="shrink-0 text-xs text-muted-foreground">{formatPlanRange(parent.plannedStartDate, parent.plannedDueDate)}</span>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground">{parent.children.length} 子任务</span>
                        </div>
                        {editable && (
                          <div className="flex shrink-0 gap-2">
                            <button
                              className={iconButtonClass()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                moveParent(stage.id, parent.id, -1);
                              }}
                              disabled={saving || parentIndex === 0}
                              title="上移项目活动"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              className={iconButtonClass()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                moveParent(stage.id, parent.id, 1);
                              }}
                              disabled={saving || parentIndex === stage.parents.length - 1}
                              title="下移项目活动"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              className={iconButtonClass()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openCreateChild(stage.id, parent.id);
                              }}
                              disabled={saving}
                              title="新增子任务"
                            >
                              +子任务
                            </button>
                            <button
                              className={iconButtonClass()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openEditParent(stage.id, parent);
                              }}
                              title="编辑项目活动"
                            >
                              <Edit3 className="h-4 w-4" />编辑
                            </button>
                            <button
                              className={dangerButtonClass()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                removeParent(stage.id, parent.id);
                              }}
                              title="删除项目活动"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </summary>

                      <div className="space-y-2 border-t border-border p-3">
                        {parent.children.map((child, childIndex) => (
                          <div key={child.id} className="flex items-center justify-between gap-3 rounded border border-border bg-slate-50 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground">{stageIndex + 1}.{parentIndex + 1}.{childIndex + 1}</span>
                              <span className="truncate text-sm">{child.title}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{child.ownerRoleName}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{child.requiresDeliverable ? '附件' : '备注'}</span>
                              <span className="truncate text-xs text-muted-foreground">{child.deliverableName || '无交付件'}</span>
                            </div>
                            {editable && (
                              <div className="flex shrink-0 gap-2">
                                <button
                                  className={iconButtonClass()}
                                  onClick={() => moveChild(stage.id, parent.id, child.id, -1)}
                                  disabled={saving || childIndex === 0}
                                  title="上移子任务"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  className={iconButtonClass()}
                                  onClick={() => moveChild(stage.id, parent.id, child.id, 1)}
                                  disabled={saving || childIndex === parent.children.length - 1}
                                  title="下移子任务"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  className={iconButtonClass()}
                                  onClick={() => openEditChild(stage.id, parent.id, child)}
                                  title="编辑子任务"
                                >
                                  <Edit3 className="h-4 w-4" />编辑
                                </button>
                                <button
                                  className={dangerButtonClass()}
                                  onClick={() => removeChild(stage.id, parent.id, child.id)}
                                  title="删除子任务"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {parent.children.length === 0 && <div className="rounded border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">暂无子任务</div>}
                      </div>
                    </details>
                  ))}
                </div>

                {stage.parents.length === 0 && <div className="rounded border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">暂无项目活动</div>}
              </div>
            </details>
          ))}

          {stages.length === 0 && <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">暂无阶段</div>}
        </div>
      </div>

      {itemDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">
                {itemDialog.mode === 'create' ? '新增' : '编辑'}
                {itemDialog.kind === 'stage' ? '阶段' : itemDialog.kind === 'parent' ? '项目活动' : '子任务'}
              </div>
              <button className={iconButtonClass()} onClick={() => setItemDialog(null)} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {itemDialog.kind === 'stage' && (
                <>
                  <label className="block text-xs font-medium text-muted-foreground">
                    阶段名称
                    <input
                      className={fieldClass('mt-1 h-9 w-full')}
                      value={itemDialog.name}
                      onChange={(event) => setItemDialog((current) => (current?.kind === 'stage' ? { ...current, name: event.target.value } : current))}
                    />
                  </label>
                  {planMode === 'date' && <DateRangeFields dialog={itemDialog} onChange={setItemDialog} />}
                </>
              )}

              {itemDialog.kind === 'parent' && (
                <>
                  <label className="block text-xs font-medium text-muted-foreground">
                    项目活动名称
                    <input
                      className={fieldClass('mt-1 h-9 w-full')}
                      value={itemDialog.name}
                      onChange={(event) => setItemDialog((current) => (current?.kind === 'parent' ? { ...current, name: event.target.value } : current))}
                    />
                  </label>
                  {planMode === 'date' && <DateRangeFields dialog={itemDialog} onChange={setItemDialog} />}
                </>
              )}

              {itemDialog.kind === 'child' && (
                <>
                  <label className="block text-xs font-medium text-muted-foreground">
                    子任务名称
                    <input
                      className={fieldClass('mt-1 h-9 w-full')}
                      value={itemDialog.title}
                      onChange={(event) => setItemDialog((current) => (current?.kind === 'child' ? { ...current, title: event.target.value } : current))}
                    />
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    责任角色
                    <select
                      className={fieldClass('mt-1 h-9 w-full')}
                      value={itemDialog.ownerRoleName}
                      onChange={(event) => {
                        setItemDialog((current) => (current?.kind === 'child'
                          ? { ...current, ownerRoleName: event.target.value }
                          : current));
                      }}
                    >
                      {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    交付件
                    <input
                      className={fieldClass('mt-1 h-9 w-full')}
                      value={itemDialog.deliverableName}
                      onChange={(event) => setItemDialog((current) => (current?.kind === 'child' ? { ...current, deliverableName: event.target.value } : current))}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={itemDialog.requiresDeliverable}
                      onChange={(event) => setItemDialog((current) => (current?.kind === 'child' ? { ...current, requiresDeliverable: event.target.checked } : current))}
                    />
                    需要附件交付件
                  </label>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button className={iconButtonClass()} onClick={() => setItemDialog(null)} disabled={saving}>取消</button>
              <button className={iconButtonClass(true)} onClick={submitItemDialog} disabled={saving}>保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function DateRangeFields({
  dialog,
  onChange,
}: {
  dialog: Extract<TemplateItemDialog, { kind: 'stage' | 'parent' }>;
  onChange: Dispatch<SetStateAction<TemplateItemDialog | null>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-muted-foreground">
        计划开始
        <input
          type="date"
          className={fieldClass('mt-1 h-9 w-full')}
          value={dialog.plannedStartDate}
          onChange={(event) => onChange((current) => (
            current?.kind === 'stage' || current?.kind === 'parent'
              ? { ...current, plannedStartDate: event.target.value }
              : current
          ))}
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        计划完成
        <input
          type="date"
          className={fieldClass('mt-1 h-9 w-full')}
          value={dialog.plannedDueDate}
          onChange={(event) => onChange((current) => (
            current?.kind === 'stage' || current?.kind === 'parent'
              ? { ...current, plannedDueDate: event.target.value }
              : current
          ))}
        />
      </label>
    </div>
  );
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatPlanRange(start?: string | null, due?: string | null) {
  if (!start && !due) return '计划 -';
  return `${formatShortDate(start)} - ${formatShortDate(due)}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
