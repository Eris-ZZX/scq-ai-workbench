'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type Props = {
  reviewId: string;
  reviewType: string;
  initialReviewerId?: string | null;
};

export function RejectedReworkActions({ reviewId, reviewType, initialReviewerId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewers, setReviewers] = useState<Array<{ id: string; username: string; displayName?: string | null }>>([]);
  const [reviewerId, setReviewerId] = useState(initialReviewerId ?? '');
  const [updateSummary, setUpdateSummary] = useState('按驳回意见修改后重新提交');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/ai-resources/reviewers');
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { reviewers?: Array<{ id: string; username: string; displayName?: string | null }> };
      const list = body.reviewers ?? [];
      setReviewers(list);
      setReviewerId((current) => current || list[0]?.id || '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function discard() {
    if (!window.confirm('确定废弃此单据？废弃后不可再提交。')) return;
    setError('');
    setMessage('');
    startTransition(async () => {
      const res = await fetch(`/api/ai-resources/review-requests/${reviewId}/discard`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '废弃失败'));
        return;
      }
      setMessage('单据已废弃。');
      router.push('/ai-resources/review?tab=done');
      router.refresh();
    });
  }

  function resubmitArchive() {
    setError('');
    setMessage('');
    if (!reviewerId || updateSummary.trim().length < 4) {
      setError('请选择审批人并填写至少 4 字说明。');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/ai-resources/review-requests/${reviewId}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId, updateSummary: updateSummary.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '重新提交失败'));
        return;
      }
      setMessage('已重新提交审批。');
      router.push(`/ai-resources/review/${reviewId}`);
      router.refresh();
    });
  }

  return (
    <div className="rejected-rework-actions">
      <p className="subtle" style={{ marginTop: 0 }}>
        单据已被驳回。你可以修改后重新提交，或废弃此单。
      </p>

      {reviewType === 'ARCHIVE' ? (
        <div className="rejected-rework-archive">
          <label className="field">
            <span>审批人</span>
            <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} disabled={pending}>
              {reviewers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName || item.username}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>说明</span>
            <textarea
              rows={3}
              value={updateSummary}
              onChange={(e) => setUpdateSummary(e.target.value)}
              disabled={pending}
            />
          </label>
          <button type="button" className="button primary" disabled={pending} onClick={resubmitArchive}>
            重新提交删除申请
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button primary"
          disabled={pending}
          onClick={() => router.push(`/ai-resources/review/${reviewId}/edit`)}
        >
          修改并重新提交
        </button>
      )}

      <button type="button" className="button danger" disabled={pending} onClick={discard}>
        废弃此单据
      </button>

      {message ? <p className="dingtalk-feedback ok">{message}</p> : null}
      {error ? <p className="dingtalk-feedback bad">{error}</p> : null}
    </div>
  );
}
