'use client';

import { useState } from 'react';
import { History } from 'lucide-react';

export type UpdateHistoryItem = {
  id: string;
  time: string;
  reason: string;
};

type LogsResponse = {
  items: Array<{
    id: string;
    createdAt: string;
    updateSummary: string;
  }>;
  page: number;
  totalPages: number;
  total: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function UpdateHistoryDialog({
  resourceId,
  initialItems,
}: {
  resourceId: string;
  initialItems: UpdateHistoryItem[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(initialItems.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recent = initialItems.slice(0, 3);

  async function loadPage(nextPage: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/ai-resources/resources/${encodeURIComponent(resourceId)}/logs?page=${nextPage}&pageSize=30`,
      );
      const data = (await res.json().catch(() => null)) as LogsResponse | null;
      if (!res.ok || !data?.items) {
        setError((data as { error?: string } | null)?.error ?? '加载更新记录失败');
        return;
      }
      setItems(
        data.items.map((log) => ({
          id: log.id,
          time: formatDate(log.createdAt),
          reason: log.updateSummary,
        })),
      );
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setError('加载更新记录失败');
    } finally {
      setLoading(false);
    }
  }

  async function openDialog() {
    setOpen(true);
    await loadPage(1);
  }

  return (
    <>
      <div className="history-summary">
        {recent.length ? (
          recent.map((item) => <span key={item.id}>{item.time}</span>)
        ) : (
          <span className="subtle">暂无更新记录。</span>
        )}
      </div>
      <button className="button" type="button" onClick={openDialog}>
        <History size={16} />
        查看更新记录
      </button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="更新记录">
          <div className="modal-panel">
            <header>
              <h2>更新记录</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <div className="timeline">
              {loading ? <p className="subtle">加载中…</p> : null}
              {error ? <p className="subtle">{error}</p> : null}
              {!loading && !error && items.length ? (
                items.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <strong>{item.time}</strong>
                    <p className="subtle">{item.reason}</p>
                  </div>
                ))
              ) : null}
              {!loading && !error && items.length === 0 ? (
                <p className="subtle">暂无更新记录。</p>
              ) : null}
            </div>
            {total > 0 ? (
              <div className="meta" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                <span className="subtle">
                  共 {total} 条 · 第 {page}/{totalPages} 页
                </span>
                <div className="meta">
                  <button
                    type="button"
                    className="button"
                    disabled={loading || page <= 1}
                    onClick={() => loadPage(page - 1)}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={loading || page >= totalPages}
                    onClick={() => loadPage(page + 1)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
