'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type {
  DevelopmentProgressOwner,
  DevelopmentProgressCategory,
  PlatformDevelopmentProjectSetting,
} from '@/lib/platform/development-progress';

type ProgressSettingsResponse = {
  categories: DevelopmentProgressCategory[];
  projects: PlatformDevelopmentProjectSetting[];
  users: DevelopmentProgressOwner[];
};

export default function PlatformDevelopmentProgressPage() {
  const [categories, setCategories] = useState<DevelopmentProgressCategory[]>([]);
  const [projects, setProjects] = useState<PlatformDevelopmentProjectSetting[]>([]);
  const [users, setUsers] = useState<DevelopmentProgressOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-development-progress', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as ProgressSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '开发进度配置加载失败。');
      setCategories((body as ProgressSettingsResponse).categories);
      setProjects((body as ProgressSettingsResponse).projects);
      setUsers((body as ProgressSettingsResponse).users);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '开发进度配置加载失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateProject(id: string, patch: Partial<PlatformDevelopmentProjectSetting>) {
    setProjects((current) => current.map((project) => (
      project.id === id ? { ...project, ...patch } : project
    )));
  }

  function addProject() {
    const categoryId = categories[0]?.id ?? '';
    setProjects((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        categoryId,
        name: '',
        progressPercent: 0,
        ownerId: null,
        note: '',
      },
    ]);
  }

  function removeProject(id: string) {
    setProjects((current) => current.filter((project) => project.id !== id));
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-development-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projects: projects.map((project) => ({
            id: project.id.startsWith('new-') ? undefined : project.id,
            categoryId: project.categoryId,
            name: project.name,
            progressPercent: project.progressPercent,
            ownerId: project.ownerId,
            note: project.note,
          })),
        }),
      });
      const body = await response.json().catch(() => null) as ProgressSettingsResponse | { error?: string } | null;
      if (!response.ok) throw new Error(body && 'error' in body ? body.error : '开发进度保存失败。');
      setCategories((body as ProgressSettingsResponse).categories);
      setProjects((body as ProgressSettingsResponse).projects);
      setUsers((body as ProgressSettingsResponse).users);
      setMessage('开发进度已保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '开发进度保存失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-md border border-border bg-white p-8 text-sm text-muted-foreground">加载开发进度配置...</div>;
  }

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">细粒度开发项目</h2>
          <p className="mt-1 text-xs text-muted-foreground">内置平台和应用作为分类选项，项目可以按更细颗粒度逐条维护。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addProject}
            disabled={saving || categories.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            新增项目
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存配置
          </button>
        </div>
      </div>

      {error && <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mx-4 mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      <div className="overflow-x-auto p-4">
        <div className="min-w-[900px] overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[1.2fr_1.6fr_100px_180px_1.5fr_40px] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>项目名称</span>
            <span>分类</span>
            <span>进度（%）</span>
            <span>负责人</span>
            <span>进度说明</span>
            <span />
          </div>
          {projects.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无开发项目，请新增项目。</div>
          ) : (
            <div className="divide-y divide-border">
              {projects.map((project) => (
                <div key={project.id} className="grid grid-cols-[1.2fr_1.6fr_100px_180px_1.5fr_40px] items-center gap-2 px-3 py-2">
                  <input
                    value={project.name}
                    onChange={(event) => updateProject(project.id, { name: event.target.value })}
                    className="h-9 rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
                    placeholder="例如：统一登录改造"
                  />
                  <select
                    value={project.categoryId}
                    onChange={(event) => updateProject(project.id, { categoryId: event.target.value })}
                    className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.title}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={project.progressPercent}
                    onChange={(event) => updateProject(project.id, {
                      progressPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                    })}
                    className="h-9 rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <select
                    value={project.ownerId ?? ''}
                    onChange={(event) => updateProject(project.id, { ownerId: event.target.value || null })}
                    className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">暂不指定</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.displayName}（{user.username}）</option>
                    ))}
                  </select>
                  <input
                    value={project.note}
                    maxLength={500}
                    onChange={(event) => updateProject(project.id, { note: event.target.value })}
                    className="h-9 rounded-md border border-border px-2 text-sm text-foreground outline-none focus:border-primary"
                    placeholder="当前阶段或计划"
                  />
                  <button
                    type="button"
                    aria-label={`删除${project.name || '开发项目'}`}
                    onClick={() => removeProject(project.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
