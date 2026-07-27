'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Edit3, RotateCcw, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

export function AdminResourceActions({
  resourceId,
  resourceName,
  status,
}: {
  resourceId: string;
  resourceName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    const confirmationName = window.prompt(`归档资源需输入完整名称以确认：\n${resourceName}`);
    if (!confirmationName) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/ai-resources/admin/resources/${resourceId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmationName }),
    });
    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setError(getErrorMessage(payload, '归档资源失败。'));
      return;
    }
    router.refresh();
  }

  async function restore() {
    if (!window.confirm(`确认恢复“${resourceName}”？`)) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/ai-resources/admin/resources/${resourceId}`, {
      method: 'POST',
    });
    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setError(getErrorMessage(payload, '恢复资源失败。'));
      return;
    }
    router.refresh();
  }

  return (
    <div className="admin-actions">
      {status !== 'ARCHIVED' ? (
        <>
          <Link className="button" href={`/ai-resources/${resourceId}/edit`}>
            <Edit3 size={15} />
            修改
          </Link>
          <button className="button danger" type="button" onClick={archive} disabled={busy}>
            <Trash2 size={15} />
            {busy ? '归档中' : '归档'}
          </button>
        </>
      ) : (
        <button className="button primary" type="button" onClick={restore} disabled={busy}>
          <RotateCcw size={15} />
          {busy ? '恢复中' : '恢复'}
        </button>
      )}
      {error ? <span className="badge danger">{error}</span> : null}
    </div>
  );
}
