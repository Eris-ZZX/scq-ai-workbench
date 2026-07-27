'use client';

import { useState } from 'react';
import { History } from 'lucide-react';

export type UpdateHistoryItem = {
  id: string;
  time: string;
  reason: string;
};

export function UpdateHistoryDialog({ items }: { items: UpdateHistoryItem[] }) {
  const [open, setOpen] = useState(false);
  const recent = items.slice(0, 3);

  return (
    <>
      <div className="history-summary">
        {recent.length ? (
          recent.map((item) => <span key={item.id}>{item.time}</span>)
        ) : (
          <span className="subtle">暂无更新记录。</span>
        )}
      </div>
      <button className="button" type="button" onClick={() => setOpen(true)}>
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
              {items.length ? (
                items.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <strong>{item.time}</strong>
                    <p className="subtle">{item.reason}</p>
                  </div>
                ))
              ) : (
                <p className="subtle">暂无更新记录。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
