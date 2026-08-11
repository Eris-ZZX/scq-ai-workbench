'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';

type AuthLoginLogItem = {
  id: string;
  provider: string;
  stage: string;
  outcome: string;
  username: string | null;
  displayName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorParams: Record<string, string>;
  hasAuthingData: boolean;
  createdAt: string;
  user: { id: string; username: string; displayName: string } | null;
};

type AuthLoginLogsResponse = {
  items: AuthLoginLogItem[];
  filters: { providers: string[]; outcomes: string[] };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const providerLabels: Record<string, string> = {
  authing: 'Authing',
  dingtalk: '钉钉',
  password: '账号密码',
};

const outcomeLabels: Record<string, string> = {
  success: '成功',
  failure: '失败',
};

export default function AuthLoginLogsPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuthLoginLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set('q', query.trim());
      if (provider) params.set('provider', provider);
      if (outcome) params.set('outcome', outcome);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      fetch(`/api/admin/auth-login-logs?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '登录日志加载失败。');
          return body as AuthLoginLogsResponse;
        })
        .then((body) => {
          setData(body);
          setError('');
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : '登录日志加载失败。');
        })
        .finally(() => setLoading(false));
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [from, outcome, page, provider, query, to]);

  const resetFilters = () => {
    setQuery('');
    setProvider('');
    setOutcome('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <label className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="搜索用户名、显示名、错误码或错误信息"
            className="h-9 w-full rounded-md border border-border pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <select
          value={provider}
          onChange={(event) => { setProvider(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">全部方式</option>
          {(data?.filters.providers ?? Object.keys(providerLabels)).map((value) => (
            <option key={value} value={value}>{providerLabels[value] || value}</option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(event) => { setOutcome(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">全部结果</option>
          {(data?.filters.outcomes ?? Object.keys(outcomeLabels)).map((value) => (
            <option key={value} value={value}>{outcomeLabels[value] || value}</option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(event) => { setFrom(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          aria-label="开始日期"
        />
        <input
          type="date"
          value={to}
          onChange={(event) => { setTo(event.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          aria-label="结束日期"
        />
        <button
          type="button"
          onClick={resetFilters}
          className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          重置
        </button>
      </div>

      {loading && !data ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-red-600">{error}</div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">暂无登录日志</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">方式 / 阶段</th>
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">结果</th>
                  <th className="px-4 py-3 font-medium">错误</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div>{providerLabels[item.provider] || item.provider}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.stage}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{item.displayName || item.user?.displayName || '未知用户'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.username || item.user?.username || '无用户名'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={item.outcome === 'success' ? 'text-emerald-600' : 'text-red-600'}>
                        {outcomeLabels[item.outcome] || item.outcome}
                      </span>
                    </td>
                    <td className="max-w-[360px] px-4 py-3">
                      {item.errorCode && <div className="font-medium text-red-700">{item.errorCode}</div>}
                      {item.errorMessage && (
                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {item.errorMessage}
                        </div>
                      )}
                      {Object.keys(item.errorParams).length > 0 && (
                        <details className="mt-1 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">错误参数</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(item.errorParams, null, 2)}</pre>
                        </details>
                      )}
                      {item.hasAuthingData && (
                        <div className="mt-1 text-xs text-blue-600">已保存 Authing claims，可导出查看</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/api/admin/auth-login-logs/${encodeURIComponent(item.id)}/export`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-primary hover:text-primary"
                      >
                        <Download className="h-3.5 w-3.5" />
                        导出详情
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </>
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
