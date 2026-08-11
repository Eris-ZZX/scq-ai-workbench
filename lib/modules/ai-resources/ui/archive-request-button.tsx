'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type ReviewerOption = { id: string; username: string; displayName?: string | null; role: string };

export function ArchiveRequestButton({
  resourceId,
  resourceName,
}: {
  resourceId: string;
  resourceName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [updateSummary, setUpdateSummary] = useState('');
  const [confirmationName, setConfirmationName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ai-resources/reviewers');
        if (!response.ok) return;
        const data = (await response.json()) as { reviewers?: ReviewerOption[] };
        if (cancelled) return;
        const list = data.reviewers ?? [];
        setReviewers(list);
        setReviewerId((current) => current || list[0]?.id || '');
      } catch {
        // submit will surface error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/ai-resources/resources/${resourceId}/archive-request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reviewerId,
          updateSummary,
          confirmationName,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(getErrorMessage(payload, '提交删除审批失败。'));
        return;
      }
      setOpen(false);
      router.push('/ai-resources/review?tab=mine');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交删除审批失败。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button danger" type="button" onClick={() => setOpen(true)}>
        <Trash2 size={16} />
        提交删除
      </button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="提交删除审批">
          <div className="modal-panel">
            <header>
              <h2>提交删除审批</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭" disabled={busy}>
                <X size={16} />
              </button>
            </header>
            <p className="subtle" style={{ margin: '0 0 12px' }}>
              删除需审批通过后生效。请选择审批人，并输入资源全名确认。
            </p>
            <div className="field">
              <label>审批人</label>
              <select
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
                required
                disabled={busy}
              >
                <option value="" disabled>
                  {reviewers.length ? '请选择审批人' : '暂无可选审批人'}
                </option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.displayName || reviewer.username}
                    {reviewer.role === 'admin' ? '（管理员）' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>删除原因</label>
              <textarea
                value={updateSummary}
                onChange={(event) => setUpdateSummary(event.target.value)}
                placeholder="说明删除原因"
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label>确认资源名称</label>
              <input
                value={confirmationName}
                onChange={(event) => setConfirmationName(event.target.value)}
                placeholder={resourceName}
                required
                disabled={busy}
              />
            </div>
            {error ? <p className="badge danger">{error}</p> : null}
            <div className="meta" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="button" type="button" onClick={() => setOpen(false)} disabled={busy}>
                取消
              </button>
              <button
                className="button danger"
                type="button"
                onClick={submit}
                disabled={
                  busy ||
                  !reviewerId ||
                  updateSummary.trim().length < 4 ||
                  confirmationName.trim() !== resourceName
                }
              >
                {busy ? '提交中…' : '提交审批'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
