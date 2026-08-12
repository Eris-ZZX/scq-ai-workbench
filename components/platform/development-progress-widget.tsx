'use client';

import { useState } from 'react';
import { Loader2, TrendingUp, X } from 'lucide-react';
import type {
  DevelopmentProgressCategory,
  DevelopmentProgressData,
  DevelopmentProgressProject,
} from '@/lib/platform/development-progress';

export default function DevelopmentProgressWidget({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DevelopmentProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!enabled) return null;

  async function openProgress() {
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/platform/development-progress', { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || '开发进度加载失败。');
      setData(body as DevelopmentProgressData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '开发进度加载失败。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="查看开发进度"
        title="开发进度"
        onClick={() => { void openProgress(); }}
        className="fixed bottom-20 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
      >
        <TrendingUp className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="development-progress-title"
            className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 id="development-progress-title" className="text-lg font-semibold text-slate-900">
                  平台应用开发进度
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  查看平台基础设施和各类应用的建设进度及负责人
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭开发进度"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 pb-5">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载开发进度...
                </div>
              ) : error ? (
                <div className="py-12 text-center text-sm text-red-600">{error}</div>
              ) : data ? (
                <div className="space-y-5 pt-5">
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">开发项目</h3>
                      <span className="text-xs text-slate-400">{data.projects.length} 项</span>
                    </div>
                    <div className="space-y-4">
                      {data.categories.map((category) => (
                        <ProgressGroup
                          key={category.id}
                          category={category}
                          projects={data.projects.filter((project) => project.categoryId === category.id)}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ProgressGroup({
  category,
  projects,
}: {
  category: DevelopmentProgressCategory;
  projects: DevelopmentProgressProject[];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-800">{category.title}</h4>
          <span className="text-xs text-slate-400">{projects.length} 个项目</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{category.description}</p>
      </div>
      {projects.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-400">该分类暂未配置开发项目</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {projects.map((project) => <ProgressRow key={project.id} project={project} />)}
        </div>
      )}
    </section>
  );
}

function ProgressRow({ project }: { project: DevelopmentProgressProject }) {
  const status = project.progressPercent >= 100
    ? '已完成'
    : project.progressPercent <= 0
      ? '待开始'
      : '开发中';
  const owner = project.owner?.displayName || project.owner?.username || '待定';

  return (
    <article className="px-3 py-3">
      <div className="grid gap-2 md:grid-cols-[minmax(180px,1.2fr)_minmax(180px,2fr)_80px_100px] md:items-center">
        <div className="min-w-0">
          <h5 className="truncate text-sm font-medium text-slate-800">{project.name}</h5>
          {project.note && <p className="mt-0.5 truncate text-xs text-slate-500">{project.note}</p>}
        </div>
        <div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>开发进度</span>
          <span>{project.progressPercent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-700 transition-[width]"
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>
        </div>
        <span className={`rounded px-2 py-0.5 text-center text-xs font-medium ${
          status === '已完成'
            ? 'bg-emerald-50 text-emerald-700'
            : status === '待开始'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-blue-50 text-blue-700'
        }`}
        >
          {status}
        </span>
        <span className="truncate text-xs text-slate-600" title={owner}>负责人：{owner}</span>
      </div>
    </article>
  );
}
