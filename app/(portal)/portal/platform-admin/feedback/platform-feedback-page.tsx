'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  FEEDBACK_APPLICATIONS,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
} from '@/lib/feedback/constants';

type FeedbackItem = {
  id: string;
  content: string;
  category: FeedbackCategory;
  application: string | null;
  pagePath: string | null;
  createdAt: string;
  user: { id: string; username: string; displayName: string } | null;
  attachments: Array<{ name: string; storedName: string; size: number; type: string }>;
};

type FeedbackResponse = {
  items: FeedbackItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function PlatformFeedbackPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [application, setApplication] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      if (application) params.set('application', application);

      fetch(`/api/admin/feedback?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '反馈日志加载失败。');
          return body as FeedbackResponse;
        })
        .then((body) => {
          setData(body);
          setError('');
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : '反馈日志加载失败。');
        })
        .finally(() => setLoading(false));
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [application, category, page, query]);

  const applicationLabels = useMemo(
    () => new Map<string, string>(FEEDBACK_APPLICATIONS.map((item) => [item.value, item.label])),
    [],
  );
  const categoryLabels = useMemo(
    () => new Map<string, string>(FEEDBACK_CATEGORIES.map((item) => [item.value, item.label])),
    [],
  );

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <label className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="搜索反馈内容、提交人或页面路径"
            className="h-9 w-full rounded-md border border-border pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <select
          value={category}
          onChange={(event) => { setCategory(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">全部类型</option>
          {FEEDBACK_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select
          value={application}
          onChange={(event) => { setApplication(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">全部应用</option>
          {FEEDBACK_APPLICATIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-red-600">{error}</div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">暂无反馈日志</div>
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-slate-800">{item.user?.displayName || item.user?.username || '已删除用户'}</span>
                  <span>{formatDate(item.createdAt)}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                    {categoryLabels.get(item.category) || item.category}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5">
                    {item.application ? applicationLabels.get(item.application) || item.application : '未关联应用'}
                  </span>
                </div>
                {item.pagePath && <span className="max-w-full truncate text-xs text-slate-400">{item.pagePath}</span>}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>
              {item.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.attachments.map((attachment) => (
                    <a
                      key={attachment.storedName}
                      href={`/api/admin/feedback/attachments/${encodeURIComponent(attachment.storedName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                      title={attachment.name}
                    >
                      <img
                        src={`/api/admin/feedback/attachments/${encodeURIComponent(attachment.storedName)}`}
                        alt={attachment.name}
                        className="h-24 w-32 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {data.pagination.total} 条</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <span>{page} / {data.pagination.totalPages}</span>
            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
