'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Edit3, FilePlus2, Plus, Save, Trash2, X } from 'lucide-react';
import {
  ActivityStructureEditor,
  cloneActivityStructure,
  type ActivityStructureStage,
} from './activity-structure-editor';

type TemplateStage = ActivityStructureStage;

type TemplateVersion = {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'retired';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  stages: TemplateStage[];
};

type TemplateSet = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  isActive: boolean;
  latestPublishedVersionId: string | null;
  versions: TemplateVersion[];
  stats: { stageCount: number; parentCount: number; childCount: number };
};

type TemplateDraft = {
  name: string;
  description: string;
  isActive: boolean;
  stages: TemplateStage[];
};

type CreateMode = 'blank' | 'import';

function statusText(status: TemplateVersion['status']) {
  if (status === 'published') return '当前';
  return '历史';
}

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

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVersionTime(version?: TemplateVersion | null) {
  if (!version) return '-';
  return formatDate(version.publishedAt ?? version.createdAt);
}

type ProjectRoleItem = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; description: string; mode: CreateMode; sourceSetId: string }>({
    name: '',
    description: '',
    mode: 'blank',
    sourceSetId: '',
  });

  // 项目角色管理
  const [projectRoles, setProjectRoles] = useState<ProjectRoleItem[]>([]);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [addRoleForm, setAddRoleForm] = useState({ code: '', name: '' });

  async function loadRoles() {
    try {
      const res = await fetch('/api/admin/project-roles');
      if (res.ok) setProjectRoles(await res.json());
    } catch { /* non-blocking */ }
  }

  async function load(preferredSetId = selectedSetId, preferredVersionId = selectedVersionId) {
    setError('');
    try {
    const [res, rolesRes] = await Promise.all([
      fetch('/api/admin/templates'),
      fetch('/api/admin/project-roles'),
    ]);
    if (!res.ok) {
      setError('模板加载失败，请刷新后重试');
      setLoading(false);
      return;
    }
    const data = (await res.json()) as TemplateSet[];
    setTemplates(data);
    if (rolesRes.ok) setProjectRoles(await rolesRes.json());
    const nextSet = data.find((item) => item.id === preferredSetId) ?? data[0];
    setSelectedSetId(nextSet?.id ?? '');
    const nextVersion =
      nextSet?.versions.find((item) => item.id === nextSet.latestPublishedVersionId) ??
      nextSet?.versions.find((item) => item.id === preferredVersionId) ??
      nextSet?.versions[0];
    setSelectedVersionId(nextVersion?.id ?? '');
    setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '模板加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSet = useMemo(
    () => templates.find((item) => item.id === selectedSetId) ?? templates[0],
    [templates, selectedSetId],
  );
  const selectedVersion = useMemo(
    () => (
      selectedSet?.versions.find((item) => item.id === selectedVersionId && item.stages.length > 0) ??
      selectedSet?.versions.find((item) => item.id === selectedSet.latestPublishedVersionId) ??
      selectedSet?.versions[0]
    ),
    [selectedSet, selectedVersionId],
  );
  const visibleStages = draft?.stages ?? selectedVersion?.stages ?? [];
  const canEdit = Boolean(selectedSet && selectedVersion && !editMode);

  async function requestJson(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, url = '/api/admin/templates') {
    setSaving(true);
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      window.alert(data?.error ?? '操作失败');
      return null;
    }
    return data;
  }

  async function saveRoleCode(role: ProjectRoleItem) {
    if (!editRoleName.trim()) { setEditRoleId(''); setEditRoleName(''); return; }
    await requestJson('PATCH', { id: role.id, name: editRoleName }, '/api/admin/project-roles');
    setEditRoleId('');
    setEditRoleName('');
    await loadRoles();
  }

  async function addRole() {
    if (!addRoleForm.code.trim()) { window.alert('请填写角色标识'); return; }
    const created = await requestJson('POST', {
      code: addRoleForm.code.trim().toUpperCase(),
      name: addRoleForm.name.trim() || addRoleForm.code.trim(),
    }, '/api/admin/project-roles');
    if (created?.id) {
      setAddRoleOpen(false);
      setAddRoleForm({ code: '', name: '' });
      await loadRoles();
    }
  }

  async function deleteRole(role: ProjectRoleItem) {
    if (!window.confirm(`删除角色"${role.name}"？`)) return;
    const res = await fetch(`/api/admin/project-roles?id=${encodeURIComponent(role.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) { window.alert(data?.error ?? '删除失败'); return; }
    await loadRoles();
  }

  function guardEditSwitch() {
    if (!editMode) return true;
    window.alert('请先保存或取消当前编辑');
    return false;
  }

  function selectTemplate(template: TemplateSet) {
    if (!guardEditSwitch()) return;
    setSelectedSetId(template.id);
    setSelectedVersionId(template.latestPublishedVersionId ?? template.versions[0]?.id ?? '');
  }

  function beginEdit() {
    if (!selectedSet || !selectedVersion) return;
    setDraft({
      name: selectedSet.name,
      description: selectedSet.description ?? '',
      isActive: selectedSet.isActive,
      stages: cloneActivityStructure(selectedVersion.stages),
    });
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditMode(false);
  }

  function updateDraft(updater: (current: TemplateDraft) => TemplateDraft) {
    setDraft((current) => (current ? updater(current) : current));
  }

  function validateDraft() {
    if (!draft?.name.trim()) return '请填写模板名称';
    for (const stage of draft.stages) {
      if (!stage.name.trim()) return '阶段名称不能为空';
      for (const parent of stage.parents) {
        if (!parent.name.trim()) return '项目活动名称不能为空';
        for (const child of parent.children) {
          if (!child.title.trim()) return '子任务名称不能为空';
        }
      }
    }
    return '';
  }

  async function saveEdit() {
    if (!selectedSet || !selectedVersion || !draft) return;
    const validationError = validateDraft();
    if (validationError) {
      window.alert(validationError);
      return;
    }

    const changeNotes = window.prompt('填写变更说明（可选）', '');
    if (changeNotes === null) return;

    const saved = await requestJson('PATCH', {
      action: 'saveTemplateEdit',
      templateSetId: selectedSet.id,
      baseVersionId: selectedVersion.id,
      name: draft.name,
      description: draft.description,
      isActive: draft.isActive,
      changeNotes,
      stages: draft.stages,
    });
    if (saved?.id) {
      setEditMode(false);
      setDraft(null);
      await load(selectedSet.id, saved.id);
    }
  }

  async function createTemplate() {
    if (!createForm.name.trim()) {
      window.alert('请填写模板名称');
      return;
    }
    if (createForm.mode === 'import' && !createForm.sourceSetId) {
      window.alert('请选择导入来源');
      return;
    }

    const created = await requestJson('POST', {
      action: 'createTemplate',
      name: createForm.name,
      description: createForm.description,
      sourceSetId: createForm.mode === 'import' ? createForm.sourceSetId : '',
    });
    if (created?.id) {
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', mode: 'blank', sourceSetId: '' });
      await load(created.id, '');
    }
  }

  async function deleteTemplate() {
    if (!selectedSet) return;
    if (!window.confirm(`确认删除模板“${selectedSet.name}”？`)) return;
    const deleted = await requestJson('DELETE', undefined, `/api/admin/templates?id=${encodeURIComponent(selectedSet.id)}`);
    if (deleted?.ok) {
      cancelEdit();
      await load('', '');
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">模板中心</h1>
            <div className="mt-1 text-sm text-muted-foreground">NPQ 活动模板</div>
          </div>
          <div className="flex gap-2">
            <button className={iconButtonClass()} onClick={() => setCreateOpen(true)} disabled={saving || editMode} title="新增模板">
              <FilePlus2 className="h-4 w-4" />新增
            </button>
            {!editMode ? (
              <button className={iconButtonClass()} onClick={beginEdit} disabled={!canEdit || saving} title="编辑模板">
                <Edit3 className="h-4 w-4" />编辑
              </button>
            ) : (
              <>
                <button className={iconButtonClass(true)} onClick={saveEdit} disabled={saving} title="保存编辑">
                  <Save className="h-4 w-4" />保存
                </button>
                <button className={iconButtonClass()} onClick={cancelEdit} disabled={saving} title="取消编辑">
                  <X className="h-4 w-4" />取消
                </button>
              </>
            )}
            <button className={dangerButtonClass()} onClick={deleteTemplate} disabled={!selectedSet || saving || editMode} title="删除模板">
              <Trash2 className="h-4 w-4" />删除
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* 项目角色管理 */}
        <section className="mb-4 rounded-lg border border-border bg-white">
          <button
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-ws-content-bg"
            onClick={() => setRolesOpen(!rolesOpen)}
          >
            {rolesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            项目角色管理
            <span className="text-xs text-muted-foreground">({projectRoles.filter((r) => r.isActive).length} 个角色，项目内权限分组和模板责任角色来源)</span>
          </button>
          {rolesOpen && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {projectRoles
                  .filter((r) => r.isActive)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((role) => (
                    <div key={role.id} className="flex items-center gap-1 rounded border border-border bg-white px-2 py-1">
                      {editRoleId === role.id ? (
                        <>
                          <input
                            className="h-6 w-24 rounded border border-border px-1 text-xs"
                            value={editRoleName}
                            onChange={(e) => setEditRoleName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveRoleCode(role); if (e.key === 'Escape') { setEditRoleId(''); setEditRoleName(''); } }}
                            autoFocus
                          />
                          <button className="inline-flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-50" onClick={() => saveRoleCode(role)} title="保存">
                            <Check className="h-3 w-3" />
                          </button>
                          <button className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-slate-50" onClick={() => { setEditRoleId(''); setEditRoleName(''); }} title="取消">
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className="cursor-pointer text-xs font-medium hover:text-ws-blue"
                            title="点击编辑名称"
                            onClick={() => { setEditRoleId(role.id); setEditRoleName(role.name); }}
                          >
                            {role.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">({role.code})</span>
                          <button
                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => deleteRole(role)}
                            title="删除角色"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                {addRoleOpen ? (
                  <div className="flex items-center gap-1 rounded border border-ws-blue bg-blue-50 px-2 py-1">
                    <input
                      className="h-6 w-16 rounded border border-border px-1 text-xs"
                      placeholder="标识"
                      value={addRoleForm.code}
                      onChange={(e) => setAddRoleForm((f) => ({ ...f, code: e.target.value }))}
                      autoFocus
                    />
                    <input
                      className="h-6 w-20 rounded border border-border px-1 text-xs"
                      placeholder="显示名"
                      value={addRoleForm.name}
                      onChange={(e) => setAddRoleForm((f) => ({ ...f, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addRole(); if (e.key === 'Escape') { setAddRoleOpen(false); setAddRoleForm({ code: '', name: '' }); } }}
                    />
                    <button className="inline-flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-50" onClick={addRole} title="保存">
                      <Check className="h-3 w-3" />
                    </button>
                    <button className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-slate-50" onClick={() => { setAddRoleOpen(false); setAddRoleForm({ code: '', name: '' }); }} title="取消">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-ws-blue hover:text-ws-blue"
                    onClick={() => setAddRoleOpen(true)}
                    title="新增角色"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                角色用于项目成员分组和模板中子任务的责任角色匹配。标识（code）唯一且不可修改。
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-4">
          <aside className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">模板</div>
            <div className="max-h-[calc(100vh-170px)] overflow-auto p-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className={`mb-2 w-full rounded border p-3 text-left transition ${
                    selectedSet?.id === template.id ? 'border-ws-blue bg-blue-50' : 'border-border bg-white hover:border-ws-blue'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{template.name}</span>
                    {template.isActive ? <Check className="h-4 w-4 text-green-600" /> : <span className="text-xs text-muted-foreground">停用</span>}
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>{template.stats.stageCount} 阶段</span>
                    <span>{template.stats.parentCount} 项目活动</span>
                    <span>{template.stats.childCount} 子任务</span>
                  </div>
                </button>
              ))}
              {templates.length === 0 && <div className="px-2 py-8 text-center text-sm text-muted-foreground">暂无模板</div>}
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3 text-sm font-medium">模板信息</div>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-3">
                  {editMode && draft ? (
                    <>
                      <label className="block text-xs font-medium text-muted-foreground">
                        名称
                        <input
                          className={fieldClass('mt-1 h-9 w-full')}
                          value={draft.name}
                          onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className="block text-xs font-medium text-muted-foreground">
                        描述
                        <textarea
                          className={fieldClass('mt-1 min-h-20 w-full py-2')}
                          value={draft.description}
                          onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
                        />
                      </label>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">状态</div>
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            className={iconButtonClass(draft.isActive)}
                            onClick={() => updateDraft((current) => ({ ...current, isActive: true }))}
                          >
                            启用
                          </button>
                          <button
                            type="button"
                            className={iconButtonClass(!draft.isActive)}
                            onClick={() => updateDraft((current) => ({ ...current, isActive: false }))}
                          >
                            停用
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">名称</div>
                        <div className="mt-1 text-sm font-medium">{selectedSet?.name ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">描述</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selectedSet?.description || '-'}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <button
                    type="button"
                    className="rounded border border-border p-3 text-left transition hover:border-ws-blue hover:text-ws-blue disabled:hover:border-border disabled:hover:text-foreground"
                    onClick={() => setVersionHistoryOpen(true)}
                    disabled={!selectedSet?.versions.length}
                  >
                    <div className="text-xs text-muted-foreground">当前版本</div>
                    <div className="mt-1 truncate font-semibold">{formatVersionTime(selectedVersion)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{selectedSet?.versions.length ?? 0} 条记录</div>
                  </button>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">状态</div>
                    <div className="mt-1 font-semibold">{(draft?.isActive ?? selectedSet?.isActive) ? '启用' : '停用'}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">项目活动</div>
                    <div className="mt-1 font-semibold">{visibleStages.reduce((sum, stage) => sum + stage.parents.length, 0)}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">子任务</div>
                    <div className="mt-1 font-semibold">{visibleStages.reduce((sum, stage) => sum + stage.parents.reduce((inner, parent) => inner + parent.children.length, 0), 0)}</div>
                  </div>
                </div>
              </div>
            </section>

            <ActivityStructureEditor
              stages={visibleStages}
              editable={editMode}
              saving={saving}
              subtitle={selectedSet?.code ?? '-'}
              onChange={(stages) => updateDraft((current) => ({ ...current, stages }))}
            />
          </div>
        </div>
      </div>
      {versionHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">变更记录</div>
                <div className="mt-1 text-xs text-muted-foreground">{selectedSet?.name ?? '-'}</div>
              </div>
              <button className={iconButtonClass()} onClick={() => setVersionHistoryOpen(false)} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-4">
              <div className="space-y-2">
                {selectedSet?.versions.map((version) => (
                  <div key={version.id} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{formatVersionTime(version)}</div>
                      <span className={`rounded px-2 py-0.5 text-xs ${version.status === 'published' ? 'bg-blue-50 text-ws-blue' : 'bg-slate-100 text-muted-foreground'}`}>
                        {statusText(version.status)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <div>更新时间：{formatDate(version.publishedAt ?? version.createdAt)}</div>
                      <div>变更说明：{version.notes || '-'}</div>
                    </div>
                  </div>
                ))}
                {!selectedSet?.versions.length && (
                  <div className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">暂无变更记录</div>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <button className={iconButtonClass(true)} onClick={() => setVersionHistoryOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">新增模板</div>
              <button className={iconButtonClass()} onClick={() => setCreateOpen(false)} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <label className="block text-xs font-medium text-muted-foreground">
                名称
                <input className={fieldClass('mt-1 h-9 w-full')} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                描述
                <textarea className={fieldClass('mt-1 min-h-20 w-full py-2')} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button className={iconButtonClass(createForm.mode === 'blank')} onClick={() => setCreateForm((current) => ({ ...current, mode: 'blank' }))}>
                  空白新建
                </button>
                <button className={iconButtonClass(createForm.mode === 'import')} onClick={() => setCreateForm((current) => ({ ...current, mode: 'import', sourceSetId: current.sourceSetId || templates[0]?.id || '' }))}>
                  从旧模板导入
                </button>
              </div>
              {createForm.mode === 'import' && (
                <select className={fieldClass('h-9 w-full')} value={createForm.sourceSetId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceSetId: event.target.value }))}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button className={iconButtonClass()} onClick={() => setCreateOpen(false)} disabled={saving}>取消</button>
              <button className={iconButtonClass(true)} onClick={createTemplate} disabled={saving}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
