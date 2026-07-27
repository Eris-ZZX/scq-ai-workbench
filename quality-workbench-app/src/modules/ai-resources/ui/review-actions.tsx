'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, X } from 'lucide-react';

export function ReviewActions({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/ai-resources/review-requests/${reviewId}/approve`, {
      method: 'POST',
    });
    setBusy(false);
    if (!response.ok) {
      setError('审批通过失败。');
      return;
    }
    router.refresh();
  }

  async function reject() {
    const reason = window.prompt('请输入驳回原因');
    if (!reason) return;

    setBusy(true);
    setError(null);
    const response = await fetch(`/api/ai-resources/review-requests/${reviewId}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!response.ok) {
      setError('驳回失败。');
      return;
    }
    router.refresh();
  }

  return (
    <div className="meta">
      <button className="button primary" onClick={approve} disabled={busy} type="button">
        <Check size={16} />
        通过
      </button>
      <button className="button danger" onClick={reject} disabled={busy} type="button">
        <X size={16} />
        驳回
      </button>
      {error ? <span className="badge danger">{error}</span> : null}
    </div>
  );
}
