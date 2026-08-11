'use client';

import { useState, useTransition } from 'react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

export type ResourceCommentItem = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; displayName?: string | null };
};

type Props = {
  resourceId: string;
  currentUserId: string;
  canModerate: boolean;
  initialComments: ResourceCommentItem[];
};

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ResourceComments({
  resourceId,
  currentUserId,
  canModerate,
  initialComments,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('评论不能为空。');
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/ai-resources/resources/${resourceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '发表评论失败。'));
        return;
      }
      const comment = body?.comment as ResourceCommentItem | undefined;
      if (comment) {
        setComments((prev) => [comment, ...prev]);
        setContent('');
      }
    });
  }

  function remove(commentId: string) {
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/ai-resources/comments/${commentId}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '删除评论失败。'));
        return;
      }
      setComments((prev) => prev.filter((item) => item.id !== commentId));
    });
  }

  return (
    <section className="panel detail-panel resource-comments">
      <h2>评论{comments.length ? `（${comments.length}）` : ''}</h2>

      <div className="comment-compose">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="写下你的看法或使用反馈"
          maxLength={1000}
          rows={3}
          disabled={pending}
        />
        <div className="comment-compose-actions">
          <span className="subtle">{content.trim().length}/1000</span>
          <button type="button" className="button primary" disabled={pending} onClick={submit}>
            发表评论
          </button>
        </div>
      </div>

      {error ? <p className="comment-feedback bad">{error}</p> : null}

      {comments.length ? (
        <ul className="comment-list">
          {comments.map((comment) => {
            const canDelete = comment.user.id === currentUserId || canModerate;
            return (
              <li className="comment-item" key={comment.id}>
                <div className="comment-meta">
                  <strong>{comment.user.displayName || comment.user.username}</strong>
                  <span className="subtle">{formatCommentTime(comment.createdAt)}</span>
                  {canDelete ? (
                    <button
                      type="button"
                      className="comment-delete"
                      disabled={pending}
                      onClick={() => remove(comment.id)}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
                <p className="comment-content">{comment.content}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="subtle">还没有评论，来写第一条吧。</p>
      )}
    </section>
  );
}
