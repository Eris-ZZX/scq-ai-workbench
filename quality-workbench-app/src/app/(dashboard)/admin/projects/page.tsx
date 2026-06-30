'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { ProjectActivityEditor } from './project-activity-editor';

type PositionBinding = null | {
  positionRoleId: string;
  positionRole: { id: string; name: string; roleName?: string | null };
};

type ProjectMember = {
  id: string;
  userId: string;
  role: string;
  assignedRole: string | null;
  user: { id: string; username: string; positionBinding: PositionBinding };
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentStage: string;
  members: ProjectMember[];
  _count: { tasks: number; activityParents: number; activityChildren: number };
};

type User = {
  id: string;
  username: string;
  status?: string;
  positionBinding: PositionBinding;
};

type SessionUser = {
  id: string;
  username: string;
  role: string;
};

type ActivityTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number | string | null;
  stats: { stageCount: number; parentCount: number; childCount: number };
};

type ProjectRoleItem = { id: string; code: string; name: string; sortOrder: number; isActive: boolean };

type AddMemberDialog = {
  roleCode: string;
  roleName: string;
  search: string;
  selectedUserIds: string[];
};

const statusOptions = [
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'completed', label: '已完成' },
];

function actionButton(active = false) {
  return `inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
    active
      ? 'border-ws-blue bg-ws-blue text-white'
      : 'border-border bg-white text-foreground hover:border-ws-blue hover:text-ws-blue'
  }`;
}

function dangerButton() {
  return 'inline-flex h-8 shrink-0 items-center gap-1 rounded border border-red-200 bg-white px-2 text-xs text-red-700 transition hover:border-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60';
}

function fieldClass(extra = '') {
  return `rounded border border-border px-2 text-sm text-foreground ${extra}`;
}

function statusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function displayUser(user?: { username: string }) {
  if (!user) return '-';
  return user.username;
}

function formatTemplateVersion(version: ActivityTemplate['version']) {
  if (!version) return 'latest';
  if (typeof version === 'number') return `V${version}`;
  return version;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectRoles, setProjectRoles] = useState<ProjectRoleItem[]>([]);
  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of projectRoles) map.set(r.code, r.name);
    return map;
  }, [projectRoles]);
  const [projectActivityRoles, setProjectActivityRoles] = useState<string[]>([]);
  const [memberDialog, setMemberDialog] = useState<AddMemberDialog | null>(null);
  const [npqSearch, setNpqSearch] = useState('');
  const [npqDropdown, setNpqDropdown] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', status: 'active', currentStage: 'TR1', ownerId: '', activityTemplateSetId: '' });
  const [basicForm, setBasicForm] = useState({ name: '', description: '', status: 'active', currentStage: 'TR1' });

  function syncBasicForm(project?: Project) {
    if (!project) return;
    setBasicForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      currentStage: project.currentStage,
    });
  }

  function selectProject(project: Project) {
    setSelectedProjectId(project.id);
    syncBasicForm(project);
  }

  async function load(preferredProjectId = selectedProjectId) {
    setError('');
    try {
    const [projectsRes, usersRes, templatesRes, meRes, rolesRes] = await Promise.all([
      fetch('/api/admin/projects'),
      fetch('/api/npq/users'),
      fetch('/api/npq/activity-templates'),
      fetch('/api/auth/me'),
      fetch('/api/npq/project-roles'),
    ]);
    if (!projectsRes.ok || !usersRes.ok || !templatesRes.ok || !meRes.ok) {
      setError('加载数据失败，请刷新后重试。');
      setLoading(false);
      return;
    }
    const nextProjects = (await projectsRes.json()) as Project[];
    const nextUsers = (await usersRes.json()) as User[];
    const nextTemplates = (await templatesRes.json()) as ActivityTemplate[];
    const currentUser = (await meRes.json()) as SessionUser;
    setIsAdmin(currentUser.role === 'admin');
    setProjects(nextProjects);
    setUsers(nextUsers);
    setTemplates(nextTemplates);
    if (rolesRes.ok) setProjectRoles(await rolesRes.json());
    setCreateForm((current) => ({
      ...current,
      activityTemplateSetId: current.activityTemplateSetId || nextTemplates[0]?.id || '',
    }));
    const nextSelected = nextProjects.find((project) => project.id === preferredProjectId) ?? nextProjects[0];
    setSelectedProjectId(nextSelected?.id ?? '');
    syncBasicForm(nextSelected);
    setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '项目管理加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeUsers = useMemo(() => users.filter((user) => !user.status || user.status === 'active'), [users]);
  const npqFiltered = useMemo(() => {
    const kw = npqSearch.trim().toLowerCase();
    return kw ? activeUsers.filter((u) => u.username.toLowerCase().includes(kw)) : activeUsers;
  }, [activeUsers, npqSearch]);
  const npqSelectedName = useMemo(() =>
    createForm.ownerId ? activeUsers.find((u) => u.id === createForm.ownerId)?.username ?? '' : '',
  [activeUsers, createForm.ownerId]);

  // 加载选中项目的活动角色
  useEffect(() => {
    if (!selectedProjectId) { setProjectActivityRoles([]); return; }
    let cancelled = false;
    fetch(`/api/admin/projects/${encodeURIComponent(selectedProjectId)}/activities`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { activityRoles?: string[] } | null) => {
        if (!cancelled && data?.activityRoles) setProjectActivityRoles(data.activityRoles);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId],
  );

  const hasUnsaved = useMemo(() => {
    if (!selectedProject) return false;
    return (
      basicForm.name !== selectedProject.name ||
      basicForm.description !== (selectedProject.description ?? '') ||
      basicForm.status !== selectedProject.status
    );
  }, [selectedProject, basicForm]);

  const projectPanelRoles = useMemo(() => {
    if (!selectedProject) return [] as { code: string; name: string }[];
    const codes = new Set<string>();
    for (const m of (selectedProject.members ?? [])) {
      const roles = (m.assignedRole ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const r of roles) codes.add(r);
    }
    for (const r of projectActivityRoles) codes.add(r);
    return Array.from(codes).sort().map((code) => ({
      code,
      name: roleNameMap.get(code) ?? code,
    }));
  }, [selectedProject, roleNameMap, projectActivityRoles]);

  async function requestJson(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, url = '/api/admin/projects') {
    setSaving(true);
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? '操作失败');
      return null;
    }
    setError('');
    return data;
  }

  function replaceProject(project: Project) {
    setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
    setSelectedProjectId(project.id);
    syncBasicForm(project);
  }

  async function createProject() {
    const name = createForm.name.trim();
    if (!name) {
      setError('请填写项目名称。');
      return;
    }
    if (templates.length > 0 && !createForm.activityTemplateSetId) {
      setError('请选择活动模板');
      return;
    }
    const created = await requestJson('POST', {
      name,
      description: createForm.description,
      status: createForm.status,
      currentStage: createForm.currentStage,
      ownerId: createForm.ownerId,
      activityTemplateSetId: createForm.activityTemplateSetId,
    });
    if (created?.id) {
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', status: 'active', currentStage: 'TR1', ownerId: '', activityTemplateSetId: templates[0]?.id ?? '' });
      await load(created.id);
    }
  }

  async function saveBasicInfo() {
    if (!selectedProject) return;
    const { currentStage: _, ...rest } = basicForm;
    const updated = await requestJson('PATCH', {
      action: 'updateProject',
      projectId: selectedProject.id,
      ...rest,
    });
    if (updated?.id) replaceProject(updated as Project);
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`删除项目"${project.name}"？项目活动、任务、人员关系会一并删除。`)) return;
    const deleted = await requestJson('DELETE', undefined, `/api/admin/projects?id=${encodeURIComponent(project.id)}`);
    if (deleted?.ok) await load('');
  }

  function memberHasRole(member: ProjectMember, roleCode: string): boolean {
    return (member.assignedRole ?? '').split(',').map((s) => s.trim()).includes(roleCode);
  }

  function selectedUserIdsForRole(roleCode: string) {
    return new Set(
      (selectedProject?.members ?? [])
        .filter((member) => memberHasRole(member, roleCode))
        .map((member) => member.userId),
    );
  }

  function selectedMembersForRole(roleCode: string) {
    return (selectedProject?.members ?? []).filter(
      (member) => memberHasRole(member, roleCode),
    );
  }

  async function addRoleMembers() {
    if (!memberDialog || !selectedProject) return;
    const updated = await requestJson('PATCH', {
      action: 'addMembers',
      projectId: selectedProject.id,
      roleName: memberDialog.roleCode,
      userIds: memberDialog.selectedUserIds,
    });
    if (updated?.id) {
      replaceProject(updated as Project);
      setMemberDialog(null);
    }
  }

  async function removeRoleMember(roleCode: string, userId: string) {
    if (!selectedProject) return;
    const updated = await requestJson('PATCH', {
      action: 'removeMember',
      projectId: selectedProject.id,
      userId,
      roleName: roleCode,
    });
    if (updated?.id) replaceProject(updated as Project);
  }

  function toggleDialogUser(userId: string, checked: boolean) {
    setMemberDialog((current) => {
      if (!current) return current;
      const selected = new Set(current.selectedUserIds);
      if (checked) selected.add(userId);
      else selected.delete(userId);
      return { ...current, selectedUserIds: Array.from(selected) };
    });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin / Projects</div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">项目管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? '后台维护项目清单、基础信息和项目成员，NPQ 分组下自动为项目负责人。' : '维护你负责项目的基础信息、项目成员和项目活动结构。'}
            </p>
          </div>
          {isAdmin && (
            <button
              className={actionButton(true)}
              onClick={() => {
                setCreateForm((current) => ({
                  ...current,
                  activityTemplateSetId: current.activityTemplateSetId || templates[0]?.id || '',
                }));
                setCreateOpen(true);
              }}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />新增项目
            </button>
          )}
        </div>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">项目列表</div>
            <div className="max-h-[calc(100vh-190px)] overflow-auto p-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`mb-2 w-full rounded border p-3 text-left transition ${
                    selectedProject?.id === project.id ? 'border-ws-blue bg-blue-50' : 'border-border bg-white hover:border-ws-blue'
                  }`}
                  onClick={() => selectProject(project)}
                >
                  <div className="truncate text-sm font-medium">{project.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{statusLabel(project.status)}</span>
                    <span>{project.currentStage}</span>
                    <span>{project.members.length} 人</span>
                  </div>
                </button>
              ))}
              {projects.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">暂无项目</div>}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            {!selectedProject ? (
              <div className="rounded-lg border border-dashed border-border bg-white px-4 py-12 text-center text-sm text-muted-foreground">
                {isAdmin ? '请选择或新增项目' : '暂无可维护项目'}
              </div>
            ) : (
              <>
                <section className="rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="text-sm font-semibold">项目基本信息</div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button className={dangerButton()} onClick={() => deleteProject(selectedProject)} disabled={saving}>
                          <Trash2 className="h-4 w-4" />删除项目
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      项目名称
                      <input className={fieldClass('mt-1 h-9 w-full')} value={basicForm.name} onChange={(event) => setBasicForm((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <div className="text-xs font-medium text-muted-foreground">
                      当前阶段
                      <div className="mt-1 flex h-9 items-center rounded border border-border bg-muted/30 px-2 text-sm text-muted-foreground">{selectedProject?.currentStage ?? '-'}</div>
                    </div>
                    <label className="text-xs font-medium text-muted-foreground">
                      状态
                      <select className={fieldClass('mt-1 h-9 w-full')} value={basicForm.status} onChange={(event) => setBasicForm((current) => ({ ...current, status: event.target.value }))}>
                        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <Info label="项目活动" value={selectedProject._count.activityParents} />
                      <Info label="子任务" value={selectedProject._count.activityChildren} />
                      <Info label="任务" value={selectedProject._count.tasks} />
                    </div>
                    <label className="text-xs font-medium text-muted-foreground md:col-span-2">
                      描述
                      <textarea className={fieldClass('mt-1 min-h-20 w-full py-2')} value={basicForm.description} onChange={(event) => setBasicForm((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                    <div className="text-xs font-medium text-muted-foreground md:col-span-2">
                      NPQ 负责人
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {(() => {
                          const npq = selectedMembersForRole('NPQ');
                          return (
                            <>
                              {npq.map((member) => (
                                <span key={member.id} className="inline-flex rounded border border-border bg-white text-sm">
                                  <span className="py-1 pl-2 pr-0.5">{displayUser(member.user)}</span>
                                  <button
                                    className="border-l border-border px-1.5 py-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                    onClick={() => removeRoleMember('NPQ', member.userId)}
                                    disabled={saving}
                                    title="移除NPQ"
                                  >×</button>
                                </span>
                              ))}
                              <button
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-ws-blue hover:text-ws-blue"
                                onClick={() => setMemberDialog({ roleCode: 'NPQ', roleName: 'NPQ', search: '', selectedUserIds: [] })}
                                disabled={saving}
                                title="增加NPQ"
                              ><Plus className="h-3.5 w-3.5" /></button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
                    {hasUnsaved && (
                      <span className="text-xs text-amber-600">有未保存的修改</span>
                    )}
                    <button className={actionButton(true)} onClick={saveBasicInfo} disabled={saving || !basicForm.name.trim()}>保存基本信息</button>
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">项目成员</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">按 NPQ、PQE、SQE、FAE、RAM、QCM 六个分组管理，从全量活跃用户中选择加入，NPQ 分组自动为项目负责人。</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{selectedProject.members.length} 人已加入</div>
                  </div>
                  <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {projectPanelRoles.filter((role) => role.code !== 'NPQ').map((role) => {
                      const selectedMembers = selectedMembersForRole(role.code);
                      return (
                        <div key={role.code} className="rounded border border-border bg-white">
                          <div className="flex items-center justify-between px-2.5 py-1.5">
                            <div>
                              <span className="text-xs font-semibold">{role.name}</span>
                              <span className="ml-1.5 text-[11px] text-muted-foreground">{selectedMembers.length}</span>
                            </div>
                            <button
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-blue-50 hover:text-ws-blue"
                              onClick={() => setMemberDialog({ roleCode: role.code, roleName: role.name, search: '', selectedUserIds: [] })}
                              disabled={saving}
                              title="增加成员"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          {selectedMembers.length > 0 && (
                            <div className="border-t border-border px-2.5 py-1">
                              {selectedMembers.map((member) => (
                                <div key={member.id} className="flex items-center py-0.5 text-xs">
                                  <span className="min-w-0 flex-1 truncate">{displayUser(member.user)}</span>
                                  <button
                                    className="ml-1 shrink-0 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                    onClick={() => removeRoleMember(role.code, member.userId)}
                                    disabled={saving}
                                    title="移除"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {projectPanelRoles.length === 0 && (
                      <div className="col-span-full py-8 text-center text-xs text-muted-foreground">暂无角色分组数据</div>
                    )}
                  </div>
                </section>

                <ProjectActivityEditor projectId={selectedProject.id} />
              </>
            )}
          </main>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">新增项目</div>
              <button className={actionButton()} onClick={() => setCreateOpen(false)}>关闭</button>
            </div>
            <div className="space-y-4 p-4">
              <label className="block text-xs font-medium text-muted-foreground">
                项目名称
                <input className={fieldClass('mt-1 h-9 w-full')} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                描述
                <textarea className={fieldClass('mt-1 min-h-20 w-full py-2')} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  状态
                  <select className={fieldClass('mt-1 h-9 w-full')} value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}>
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  当前阶段
                  <input className={fieldClass('mt-1 h-9 w-full')} value={createForm.currentStage} onChange={(event) => setCreateForm((current) => ({ ...current, currentStage: event.target.value }))} />
                </label>
              </div>
              <label className="block text-xs font-medium text-muted-foreground">
                活动模板
                <select
                  className={fieldClass('mt-1 h-9 w-full')}
                  value={createForm.activityTemplateSetId}
                  onChange={(event) => setCreateForm((current) => ({ ...current, activityTemplateSetId: event.target.value }))}
                  disabled={templates.length === 0}
                >
                  {templates.length === 0 ? (
                    <option value="">暂无可用模板</option>
                  ) : templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} / {formatTemplateVersion(template.version)} / {template.stats.parentCount} 项目活动 / {template.stats.childCount} 子任务
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                  创建时一次性导入所选模板的最新版本，之后项目活动独立维护，不随模板中心同步。
                </span>
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                初始 NPQ
                <div className="relative mt-1">
                  <input
                    className={fieldClass('h-9 w-full')}
                    placeholder="搜索用户名..."
                    value={npqDropdown ? npqSearch : npqSelectedName}
                    onFocus={() => { setNpqDropdown(true); setNpqSearch(''); }}
                    onChange={(event) => setNpqSearch(event.target.value)}
                    onBlur={() => setTimeout(() => setNpqDropdown(false), 150)}
                  />
                  {npqDropdown && (
                    <div
                      className="absolute bottom-full z-10 mb-1 max-h-48 w-full overflow-auto rounded border border-border bg-white shadow-lg"
                      onWheel={(e) => e.stopPropagation()}
                    >                      <div
                        className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground hover:bg-ws-content-bg"
                        onMouseDown={() => { setCreateForm((c) => ({ ...c, ownerId: '' })); setNpqDropdown(false); setNpqSearch(''); }}
                      >暂不指定</div>
                      {npqFiltered.map((user) => (
                        <div
                          key={user.id}
                          className="cursor-pointer px-3 py-1.5 text-sm hover:bg-ws-content-bg"
                          onMouseDown={() => { setCreateForm((c) => ({ ...c, ownerId: user.id })); setNpqDropdown(false); setNpqSearch(''); }}
                        >{displayUser(user)}</div>
                      ))}
                      {npqFiltered.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">未找到匹配用户</div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button className={actionButton()} onClick={() => setCreateOpen(false)} disabled={saving}>取消</button>
              <button className={actionButton(true)} onClick={createProject} disabled={saving || !createForm.name.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}

      {memberDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">增加 {memberDialog.roleName} 分组成员</div>
              <button className={actionButton()} onClick={() => setMemberDialog(null)} disabled={saving}>关闭</button>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={fieldClass('h-9 w-full pl-8')}
                  value={memberDialog.search}
                  onChange={(event) => setMemberDialog((current) => current ? { ...current, search: event.target.value } : current)}
                  placeholder="搜索用户名或角色..."
                  disabled={saving}
                />
              </div>

              {(() => {
                const selected = selectedUserIdsForRole(memberDialog.roleCode);
                const keyword = memberDialog.search.trim().toLowerCase();
                const availableUsers = activeUsers
                  .filter((user) => !selected.has(user.id))
                  .filter((user) => {
                    if (!keyword) return true;
                    return user.username.toLowerCase().includes(keyword);
                  });
                return (
                  <div className="max-h-72 overflow-auto rounded border border-border p-2">
                    {availableUsers.length === 0 ? (
                      <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                        {keyword ? '未找到匹配用户' : '暂无可用人员'}
                      </div>
                    ) : (
                      availableUsers.map((user) => (
                        <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ws-content-bg">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={memberDialog.selectedUserIds.includes(user.id)}
                            onChange={(event) => toggleDialogUser(user.id, event.target.checked)}
                            disabled={saving}
                          />
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate">{displayUser(user)}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button className={actionButton()} onClick={() => setMemberDialog(null)} disabled={saving}>取消</button>
              <button
                className={actionButton(true)}
                onClick={addRoleMembers}
                disabled={saving || memberDialog.selectedUserIds.length === 0}
              >
                确认增加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
