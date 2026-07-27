'use client';

import { useState, useTransition } from 'react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

export function AdminMaintenanceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      setMessage('');
      const res = await fetch('/api/ai-resources/admin/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(getErrorMessage(body, '切换失败。'));
        return;
      }
      setEnabled(Boolean(body.maintenanceMode));
      setMessage(next ? '维护模式已开启，变更写入已冻结。' : '维护模式已关闭。');
    });
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>维护模式</h2>
      <p className="subtle">
        开启后，写事务内锁定 ModuleSettings 并返回 503。切流后回滚前须先进入维护模式。
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <strong>当前：{enabled ? '开启' : '关闭'}</strong>
        <button type="button" className={enabled ? 'danger' : 'primary'} onClick={toggle} disabled={pending}>
          {enabled ? '关闭维护模式' : '开启维护模式'}
        </button>
      </div>
      {message ? <p className="subtle">{message}</p> : null}
    </section>
  );
}
