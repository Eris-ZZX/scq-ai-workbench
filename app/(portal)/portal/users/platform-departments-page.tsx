'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Download, FileJson, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  syncAt: string;
};

type DepartmentForm = {
  id: string;
  name: string;
  parentId: string;
};

const emptyForm: DepartmentForm = { id: '', name: '', parentId: '' };

function formatSyncAt(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function extractDepartments(value: unknown): Array<{ id: string; name: string; parentId: string | null }> {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { departments?: unknown }).departments)
      ? (value as { departments: unknown[] }).departments
      : null;
  if (!items) throw new Error('JSON 须为数组，或包含 departments 数组。');

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${index + 1} 条组织映射格式不正确。`);
    }
    const record = item as { id?: unknown; name?: unknown; parentId?: unknown };
    if (typeof record.id !== 'string' || !record.id.trim()) {
      throw new Error(`第 ${index + 1} 条组织映射缺少 id。`);
    }
    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error(`第 ${index + 1} 条组织映射缺少 name。`);
    }
    if (record.parentId !== null && record.parentId !== undefined && typeof record.parentId !== 'string') {
      throw new Error(`第 ${index + 1} 条组织映射的 parentId 必须是字符串或 null。`);
    }
    return {
      id: record.id.trim(),
      name: record.name.trim(),
      parentId: typeof record.parentId === 'string' && record.parentId.trim() ? record.parentId.trim() : null,
    };
  });
}

export default function PlatformDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const parentNames = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments],
  );

  async function load(nextQuery = query) {
    setLoading(true);
    setError('');
    try {
      const suffix = nextQuery.trim() ? `?q=${encodeURIComponent(nextQuery.trim())}` : '';
      const response = await fetch(`/api/admin/platform-departments${suffix}`, { cache: 'no-store' });
      const body = await response.json().catch(() => null) as { departments?: Department[]; error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? '加载组织映射失败。');
        return;
      }
      setDepartments(body?.departments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载组织映射失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function editDepartment(department: Department) {
    setEditingId(department.id);
    setForm({
      id: department.id,
      name: department.name,
      parentId: department.parentId ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-departments', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          parentId: form.parentId || null,
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? '保存组织映射失败。');
        return;
      }
      setMessage(editingId ? '组织映射已更新。' : '组织映射已创建。');
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存组织映射失败。');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(id: string) {
    if (!window.confirm(`确认删除组织映射 ${id}？`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/platform-departments?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? '删除组织映射失败。');
        return;
      }
      setMessage('组织映射已删除。');
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除组织映射失败。');
    } finally {
      setSaving(false);
    }
  }

  async function importJson() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const departmentsToImport = extractDepartments(JSON.parse(jsonText));
      if (departmentsToImport.length === 0) throw new Error('导入列表不能为空。');
      const response = await fetch('/api/admin/platform-departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: departmentsToImport }),
      });
      const body = await response.json().catch(() => null) as { count?: number; error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? '导入组织映射失败。');
        return;
      }
      setMessage(`已导入 ${body?.count ?? departmentsToImport.length} 条组织映射。`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 格式不正确。');
    } finally {
      setSaving(false);
    }
  }

  async function readImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setJsonText(await file.text());
      setFileName(file.name);
      setMessage(`已读取文件：${file.name}，请点击“导入 JSON”。`);
      setError('');
    } catch {
      setError('读取 JSON 文件失败。');
    }
  }

  async function exportJson() {
    try {
      const response = await fetch('/api/admin/platform-departments', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as { departments?: Department[]; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? '读取组织映射失败。');
      const payload = JSON.stringify({
        departments: (body?.departments ?? []).map(({ id, name, parentId }) => ({ id, name, parentId })),
      }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dingtalk-department-mappings.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`已导出 ${body?.departments?.length ?? 0} 条组织映射。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出组织映射失败。');
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">组织小组 ID 映射</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              维护钉钉组织 ID、中文名和上级组织 ID。导入采用按 ID upsert，未出现在 JSON 中的旧记录会保留。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded border border-border bg-white px-3 text-sm hover:border-primary disabled:opacity-50"
              onClick={() => void load()}
              disabled={loading || saving}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded border border-border bg-white px-3 text-sm hover:border-primary disabled:opacity-50"
              onClick={() => void exportJson()}
              disabled={saving}
            >
              <Download className="h-4 w-4" />
              导出 JSON
            </button>
          </div>
        </div>
        {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">{editingId ? '编辑组织映射' : '新增组织映射'}</h3>
            {editingId ? (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={resetForm}>
                <X className="h-3.5 w-3.5" />
                取消编辑
              </button>
            ) : null}
          </div>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => void saveDepartment(event)}>
            <label className="block text-xs text-muted-foreground">
              组织 ID
              <input
                className="mt-1 h-9 w-full rounded border border-border px-2 text-sm text-foreground disabled:bg-muted"
                value={form.id}
                disabled={Boolean(editingId) || saving}
                onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
                placeholder="例如 735167643"
                required
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              中文名称
              <input
                className="mt-1 h-9 w-full rounded border border-border px-2 text-sm text-foreground"
                value={form.name}
                disabled={saving}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 QCM组"
                required
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              上级组织 ID
              <input
                className="mt-1 h-9 w-full rounded border border-border px-2 text-sm text-foreground"
                value={form.parentId}
                disabled={saving}
                onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
                placeholder="顶级组织留空"
              />
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" className="inline-flex h-9 items-center gap-1 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={saving}>
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? '保存修改' : '新增映射'}
              </button>
              {editingId ? (
                <button type="button" className="h-9 rounded border border-border px-3 text-sm hover:border-primary" onClick={resetForm} disabled={saving}>
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground">导入 JSON</h3>
              <p className="mt-1 text-xs text-muted-foreground">只需 id、name、parentId，syncAt 由系统自动维护。</p>
            </div>
            <FileJson className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded border border-border bg-white px-3 text-sm hover:border-primary">
              <Upload className="h-4 w-4" />
              选择 JSON 文件
              <input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void readImportFile(event)} />
            </label>
            {fileName ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
            <button type="button" className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={() => void importJson()} disabled={saving || !jsonText.trim()}>
              导入 JSON
            </button>
          </div>
          <textarea
            className="mt-3 min-h-36 w-full rounded border border-border p-2 font-mono text-xs text-foreground outline-none focus:border-primary"
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setFileName('');
            }}
            placeholder={'粘贴 JSON，例如：\n{\n  "departments": [\n    { "id": "735167643", "name": "QCM组", "parentId": "155031570" }\n  ]\n}'}
          />
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">映射表（{departments.length} 条）</div>
          <form className="flex h-9 items-center rounded border border-border" onSubmit={(event) => { event.preventDefault(); void load(); }}>
            <Search className="ml-2 h-4 w-4 text-muted-foreground" />
            <input
              className="h-full w-64 bg-transparent px-2 text-sm text-foreground outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 ID、名称或上级 ID"
            />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">组织 ID</th>
                <th className="px-4 py-3">中文名称</th>
                <th className="px-4 py-3">上级组织</th>
                <th className="px-4 py-3">最后维护时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{department.id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{department.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {department.parentId ? (
                      <span>{parentNames.get(department.parentId) ?? '未加载名称'} <span className="font-mono text-xs">({department.parentId})</span></span>
                    ) : '顶级组织'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatSyncAt(department.syncAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary" onClick={() => editDepartment(department)} disabled={saving}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button type="button" className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-400" onClick={() => void deleteDepartment(department.id)} disabled={saving}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {loading ? '加载中...' : '暂无组织映射。'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
