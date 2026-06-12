'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Layers3, Plus, Rocket, Save, ToggleLeft, ToggleRight } from 'lucide-react';

type TemplateChild = {
  id: string;
  title: string;
  ownerRoleName: string;
  roleGroup: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  isRequired: boolean;
  sortOrder: number;
};

type TemplateParent = {
  id: string;
  name: string;
  description: string | null;
  closureStandard: string | null;
  plannedOffsetDays: number | null;
  sortOrder: number;
  children: TemplateChild[];
};

type TemplateStage = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  parents: TemplateParent[];
};

type TemplateVersion = {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'retired';
  publishedAt: string | null;
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

const roleOptions = ['NPQ', 'PQE', 'SQE', 'FAE', 'RAM', 'QCM'];

function statusText(status: TemplateVersion['status']) {
  if (status === 'published') return '已发布';
  if (status === 'draft') return '草稿';
  return '已归档';
}

function iconButtonClass(active = false) {
  return `inline-flex h-8 items-center gap-1 rounded border px-2 text-xs transition ${
    active
      ? 'border-ws-blue bg-ws-blue text-white'
      : 'border-border bg-white text-foreground hover:border-ws-blue hover:text-ws-blue'
  }`;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stageForm, setStageForm] = useState({ code: '', name: '' });
  const [parentForm, setParentForm] = useState<Record<string, string>>({});
  const [childForm, setChildForm] = useState<Record<string, { title: string; roleGroup: string; deliverableName: string; requiresDeliverable: boolean }>>({});

  async function load(preferredSetId = selectedSetId, preferredVersionId = selectedVersionId) {
    const res = await fetch('/api/admin/templates');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as TemplateSet[];
    setTemplates(data);
    const nextSet = data.find((item) => item.id === preferredSetId) ?? data[0];
    setSelectedSetId(nextSet?.id ?? '');
    const nextVersion =
      nextSet?.versions.find((item) => item.id === preferredVersionId) ??
      nextSet?.versions.find((item) => item.status === 'draft') ??
      nextSet?.versions.find((item) => item.id === nextSet.latestPublishedVersionId) ??
      nextSet?.versions[0];
    setSelectedVersionId(nextVersion?.id ?? '');
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const selectedSet = useMemo(
    () => templates.find((item) => item.id === selectedSetId) ?? templates[0],
    [templates, selectedSetId],
  );
  const selectedVersion = useMemo(
    () => selectedSet?.versions.find((item) => item.id === selectedVersionId) ?? selectedSet?.versions[0],
    [selectedSet, selectedVersionId],
  );
  const editable = selectedVersion?.status === 'draft';

  async function post(action: string, body: Record<string, unknown>, preferredVersionId = selectedVersionId) {
    setSaving(true);
    const res = await fetch('/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      window.alert(data?.error ?? '操作失败');
      return null;
    }
    await load(selectedSetId, preferredVersionId);
    return data;
  }

  async function patch(action: string, body: Record<string, unknown>, preferredVersionId = selectedVersionId) {
    setSaving(true);
    const res = await fetch('/api/admin/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      window.alert(data?.error ?? '操作失败');
      return null;
    }
    await load(selectedSetId, preferredVersionId);
    return data;
  }

  async function duplicateTemplate() {
    if (!selectedSet) return;
    const name = window.prompt('新模板名称', `${selectedSet.name} 副本`);
    if (!name?.trim()) return;
    const created = await post('duplicateTemplate', { sourceSetId: selectedSet.id, name: name.trim() });
    if (created?.id) {
      await load(created.id, '');
    }
  }

  async function createDraft() {
    if (!selectedSet) return;
    const draft = await patch('createDraft', { templateSetId: selectedSet.id }, '');
    if (draft?.id) setSelectedVersionId(draft.id);
  }

  async function addStage() {
    if (!selectedVersion || !stageForm.code.trim()) return;
    await post('addStage', { versionId: selectedVersion.id, code: stageForm.code, name: stageForm.name || stageForm.code });
    setStageForm({ code: '', name: '' });
  }

  async function addParent(stageId: string) {
    const name = parentForm[stageId]?.trim();
    if (!name) return;
    await post('addParent', { stageId, name });
    setParentForm((prev) => ({ ...prev, [stageId]: '' }));
  }

  async function addChild(parentId: string) {
    const value = childForm[parentId];
    if (!value?.title.trim()) return;
    await post('addChild', {
      parentId,
      title: value.title,
      roleGroup: value.roleGroup || 'NPQ',
      ownerRoleName: value.roleGroup || 'NPQ',
      deliverableName: value.deliverableName,
      requiresDeliverable: value.requiresDeliverable,
    });
    setChildForm((prev) => ({ ...prev, [parentId]: { title: '', roleGroup: 'NPQ', deliverableName: '', requiresDeliverable: false } }));
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
            <button className={iconButtonClass()} onClick={duplicateTemplate} disabled={!selectedSet || saving} title="复制模板">
              <Copy className="h-4 w-4" />复制
            </button>
            <button className={iconButtonClass()} onClick={createDraft} disabled={!selectedSet || saving} title="从最新发布版创建草稿">
              <Plus className="h-4 w-4" />草稿
            </button>
            <button className={iconButtonClass()} onClick={() => selectedVersion && patch('publishVersion', { versionId: selectedVersion.id })} disabled={!editable || saving} title="发布当前草稿">
              <Rocket className="h-4 w-4" />发布
            </button>
            <button
              className={iconButtonClass(Boolean(selectedSet?.isActive))}
              onClick={() => selectedSet && patch('updateSet', { id: selectedSet.id, isActive: !selectedSet.isActive })}
              disabled={!selectedSet || saving}
              title="启用或停用模板"
            >
              {selectedSet?.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {selectedSet?.isActive ? '启用' : '停用'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[300px_minmax(0,1fr)_300px] gap-4">
          <aside className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">模板</div>
            <div className="max-h-[calc(100vh-170px)] overflow-auto p-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedSetId(template.id);
                    setSelectedVersionId(template.versions.find((version) => version.status === 'draft')?.id ?? template.latestPublishedVersionId ?? template.versions[0]?.id ?? '');
                  }}
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
                    <span>{template.stats.parentCount} 母任务</span>
                    <span>{template.stats.childCount} 子任务</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 rounded-lg border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selectedSet?.name ?? '暂无模板'}</div>
                <div className="mt-1 text-xs text-muted-foreground">{selectedSet?.code}</div>
              </div>
              <div className="flex gap-2">
                {selectedSet?.versions.map((version) => (
                  <button
                    key={version.id}
                    className={iconButtonClass(version.id === selectedVersion?.id)}
                    onClick={() => setSelectedVersionId(version.id)}
                    title={`v${version.version} ${statusText(version.status)}`}
                  >
                    v{version.version} {statusText(version.status)}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-170px)] overflow-auto p-4">
              {editable && (
                <div className="mb-4 flex gap-2 rounded-lg border border-dashed border-border p-3">
                  <input
                    className="h-9 w-28 rounded border border-border px-2 text-sm"
                    placeholder="阶段编码"
                    value={stageForm.code}
                    onChange={(event) => setStageForm((prev) => ({ ...prev, code: event.target.value }))}
                  />
                  <input
                    className="h-9 flex-1 rounded border border-border px-2 text-sm"
                    placeholder="阶段名称"
                    value={stageForm.name}
                    onChange={(event) => setStageForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <button className={iconButtonClass()} onClick={addStage} disabled={saving} title="新增阶段">
                    <Plus className="h-4 w-4" />阶段
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {selectedVersion?.stages.map((stage) => (
                  <section key={stage.id} className="rounded-lg border border-border">
                    <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-4 py-3">
                      <Layers3 className="h-4 w-4 text-ws-blue" />
                      {editable ? (
                        <>
                          <input
                            className="h-8 w-24 rounded border border-border px-2 text-sm font-medium"
                            defaultValue={stage.code}
                            onBlur={(event) => event.target.value !== stage.code && patch('updateStage', { id: stage.id, code: event.target.value })}
                          />
                          <input
                            className="h-8 flex-1 rounded border border-border px-2 text-sm"
                            defaultValue={stage.name}
                            onBlur={(event) => event.target.value !== stage.name && patch('updateStage', { id: stage.id, name: event.target.value })}
                          />
                        </>
                      ) : (
                        <>
                          <div className="font-medium">{stage.code}</div>
                          <div className="text-sm text-muted-foreground">{stage.name}</div>
                        </>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {stage.parents.map((parent) => (
                        <div key={parent.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              {editable ? (
                                <input
                                  className="h-8 w-full rounded border border-border px-2 text-sm font-medium"
                                  defaultValue={parent.name}
                                  onBlur={(event) => event.target.value !== parent.name && patch('updateParent', { id: parent.id, name: event.target.value })}
                                />
                              ) : (
                                <div className="truncate text-sm font-medium">{parent.name}</div>
                              )}
                              <div className="mt-1 text-xs text-muted-foreground">{parent.children.length} 子任务</div>
                            </div>
                            {editable && (
                              <button
                                className={iconButtonClass()}
                                onClick={() => patch('updateParent', { id: parent.id, name: parent.name, plannedOffsetDays: parent.plannedOffsetDays ?? 30 })}
                                disabled={saving}
                                title="保存母任务"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                              <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                  <th className="py-2 pr-3">子任务</th>
                                  <th className="w-24 py-2 pr-3">岗位</th>
                                  <th className="w-48 py-2 pr-3">交付件</th>
                                  <th className="w-20 py-2 pr-3">标准</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parent.children.map((child) => (
                                  <tr key={child.id} className="border-b border-border last:border-0">
                                    <td className="py-2 pr-3">
                                      {editable ? (
                                        <input
                                          className="h-8 w-full rounded border border-border px-2 text-sm"
                                          defaultValue={child.title}
                                          onBlur={(event) => event.target.value !== child.title && patch('updateChild', { id: child.id, title: event.target.value })}
                                        />
                                      ) : child.title}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {editable ? (
                                        <select
                                          className="h-8 w-full rounded border border-border px-2 text-sm"
                                          defaultValue={child.roleGroup}
                                          onChange={(event) => patch('updateChild', { id: child.id, roleGroup: event.target.value, ownerRoleName: event.target.value })}
                                        >
                                          {roleOptions.map((role) => <option key={role}>{role}</option>)}
                                        </select>
                                      ) : child.roleGroup}
                                    </td>
                                    <td className="py-2 pr-3 text-muted-foreground">
                                      {editable ? (
                                        <input
                                          className="h-8 w-full rounded border border-border px-2 text-sm text-foreground"
                                          defaultValue={child.deliverableName ?? ''}
                                          onBlur={(event) => event.target.value !== (child.deliverableName ?? '') && patch('updateChild', { id: child.id, deliverableName: event.target.value })}
                                        />
                                      ) : child.deliverableName ?? '-'}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {editable ? (
                                        <label className="inline-flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            defaultChecked={child.requiresDeliverable}
                                            onChange={(event) => patch('updateChild', { id: child.id, requiresDeliverable: event.target.checked })}
                                          />
                                          附件
                                        </label>
                                      ) : child.requiresDeliverable ? '附件' : '备注'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {editable && (
                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px_minmax(0,180px)_82px_76px] gap-2">
                              <input
                                className="h-9 rounded border border-border px-2 text-sm"
                                placeholder="新增子任务"
                                value={childForm[parent.id]?.title ?? ''}
                                onChange={(event) => setChildForm((prev) => ({ ...prev, [parent.id]: { title: event.target.value, roleGroup: prev[parent.id]?.roleGroup ?? 'NPQ', deliverableName: prev[parent.id]?.deliverableName ?? '', requiresDeliverable: prev[parent.id]?.requiresDeliverable ?? false } }))}
                              />
                              <select
                                className="h-9 rounded border border-border px-2 text-sm"
                                value={childForm[parent.id]?.roleGroup ?? 'NPQ'}
                                onChange={(event) => setChildForm((prev) => ({ ...prev, [parent.id]: { title: prev[parent.id]?.title ?? '', roleGroup: event.target.value, deliverableName: prev[parent.id]?.deliverableName ?? '', requiresDeliverable: prev[parent.id]?.requiresDeliverable ?? false } }))}
                              >
                                {roleOptions.map((role) => <option key={role}>{role}</option>)}
                              </select>
                              <input
                                className="h-9 rounded border border-border px-2 text-sm"
                                placeholder="交付件"
                                value={childForm[parent.id]?.deliverableName ?? ''}
                                onChange={(event) => setChildForm((prev) => ({ ...prev, [parent.id]: { title: prev[parent.id]?.title ?? '', roleGroup: prev[parent.id]?.roleGroup ?? 'NPQ', deliverableName: event.target.value, requiresDeliverable: prev[parent.id]?.requiresDeliverable ?? false } }))}
                              />
                              <label className="flex h-9 items-center gap-1 rounded border border-border px-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={childForm[parent.id]?.requiresDeliverable ?? false}
                                  onChange={(event) => setChildForm((prev) => ({ ...prev, [parent.id]: { title: prev[parent.id]?.title ?? '', roleGroup: prev[parent.id]?.roleGroup ?? 'NPQ', deliverableName: prev[parent.id]?.deliverableName ?? '', requiresDeliverable: event.target.checked } }))}
                                />
                                附件
                              </label>
                              <button className={iconButtonClass()} onClick={() => addChild(parent.id)} disabled={saving} title="新增子任务">
                                <Plus className="h-4 w-4" />子项
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {editable && (
                        <div className="flex gap-2 px-4 py-3">
                          <input
                            className="h-9 flex-1 rounded border border-border px-2 text-sm"
                            placeholder="新增母任务"
                            value={parentForm[stage.id] ?? ''}
                            onChange={(event) => setParentForm((prev) => ({ ...prev, [stage.id]: event.target.value }))}
                          />
                          <button className={iconButtonClass()} onClick={() => addParent(stage.id)} disabled={saving} title="新增母任务">
                            <Plus className="h-4 w-4" />母任务
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </main>

          <aside className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">属性</div>
            <div className="space-y-4 p-4">
              <label className="block text-xs font-medium text-muted-foreground">
                名称
                <input
                  className="mt-1 h-9 w-full rounded border border-border px-2 text-sm text-foreground"
                  defaultValue={selectedSet?.name}
                  onBlur={(event) => selectedSet && event.target.value !== selectedSet.name && patch('updateSet', { id: selectedSet.id, name: event.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                描述
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-border px-2 py-2 text-sm text-foreground"
                  defaultValue={selectedSet?.description ?? ''}
                  onBlur={(event) => selectedSet && event.target.value !== (selectedSet.description ?? '') && patch('updateSet', { id: selectedSet.id, description: event.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">版本</div>
                  <div className="mt-1 font-semibold">{selectedSet?.versions.length ?? 0}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">状态</div>
                  <div className="mt-1 font-semibold">{selectedSet?.isActive ? '启用' : '停用'}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">母任务</div>
                  <div className="mt-1 font-semibold">{selectedSet?.stats.parentCount ?? 0}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">子任务</div>
                  <div className="mt-1 font-semibold">{selectedSet?.stats.childCount ?? 0}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
