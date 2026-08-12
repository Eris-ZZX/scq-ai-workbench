'use client';

import { useState } from 'react';
import { Loader2, TrendingUp, X } from 'lucide-react';
import type {
  DevelopmentProgressData,
  PlatformDevelopmentItem,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="development-progress-title"
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
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
                    <h3 className="text-sm font-semibold text-slate-900">平台与应用</h3>
                    <span className="text-xs text-slate-400">{data.platform.length} 项</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.platform.map((item) => (
                      <ProgressCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

function ProgressCard({ item }: { item: PlatformDevelopmentItem }) {
  const status = item.progressPercent >= 100
    ? '已上线'
    : item.progressPercent <= 0
      ? '规划中'
      : '开发中';
  const owner = item.owner?.displayName || item.owner?.username || '待定';

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900">{item.title}</h4>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
          status === '已上线'
            ? 'bg-emerald-50 text-emerald-700'
            : status === '规划中'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-blue-50 text-blue-700'
        }`}
        >
          {status}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>开发进度</span>
          <span>{item.progressPercent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-700 transition-[width]"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 text-xs">
        <span className="text-slate-500">负责人</span>
        <span className="text-right font-medium text-slate-700">{owner}</span>
      </div>
      {item.note && <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-500">{item.note}</p>}
    </article>
  );
}
