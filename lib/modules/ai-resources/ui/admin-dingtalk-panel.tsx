'use client';

import { useState, useTransition } from 'react';
import type { DingTalkNotificationCategory } from '@/lib/dingtalk/settings';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type NotificationSettings = Record<DingTalkNotificationCategory, boolean>;

type Props = {
  initialNotifications: NotificationSettings;
};

const NOTIFICATION_DEFINITIONS: Array<{
  category: DingTalkNotificationCategory;
  title: string;
  description: string;
  audience: string;
}> = [
  {
    category: 'reviewSubmitted',
    title: '待审批通知',
    description: '资源提交新建、修改或删除申请后，通知对应审批人。',
    audience: '对应审批人',
  },
  {
    category: 'reviewRejected',
    title: '驳回待处理通知',
    description: '审批驳回后，通知提交人修改或废弃申请。',
    audience: '申请提交人',
  },
  {
    category: 'reviewApproved',
    title: '审批通过通知',
    description: '审批通过后，通知提交人查看审批结果。',
    audience: '申请提交人',
  },
  {
    category: 'publish',
    title: '资源发布与更新广播',
    description: '资源审批通过后，向资源库成员发送发布或更新通知。',
    audience: '已匹配钉钉的 AI 资源库成员',
  },
];

export function AdminDingTalkPanel({
  initialNotifications,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotifications);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingCategory, setTestingCategory] = useState<DingTalkNotificationCategory | null>(
    null,
  );
  const [testingTodoCategory, setTestingTodoCategory] = useState<DingTalkNotificationCategory | null>(
    null,
  );
  const [completingTodo, setCompletingTodo] = useState(false);
  const [lastTestTaskId, setLastTestTaskId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(category: DingTalkNotificationCategory, next: boolean) {
    setMessage('');
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/ai-resources/admin/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, enabled: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '保存失败'));
        return;
      }
      if (body.notifications) {
        setNotifications(body.notifications);
      } else {
        setNotifications((current) => ({ ...current, [category]: next }));
      }
      const definition = NOTIFICATION_DEFINITIONS.find((item) => item.category === category);
      setMessage(`${definition?.title ?? '通知'}已${next ? '开启' : '关闭'}。`);
    });
  }

  function sendTest(category: DingTalkNotificationCategory) {
    setMessage('');
    setError('');
    setTestingCategory(category);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-resources/admin/settings/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test', category }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(getErrorMessage(body, '测试发送失败'));
          return;
        }
        const definition = NOTIFICATION_DEFINITIONS.find((item) => item.category === category);
        setMessage(`${definition?.title ?? '通知'}测试消息已发送。`);
      } finally {
        setTestingCategory(null);
      }
    });
  }

  function sendTestTodo(category: DingTalkNotificationCategory) {
    setMessage('');
    setError('');
    setTestingTodoCategory(category);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-resources/admin/settings/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test-todo', category }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(getErrorMessage(body, '测试待办创建失败'));
          return;
        }
        if (typeof body.taskId === 'string') {
          setLastTestTaskId(body.taskId);
        }
        const definition = NOTIFICATION_DEFINITIONS.find((item) => item.category === category);
        setMessage(`${definition?.title ?? '通知'}测试待办已创建。`);
      } finally {
        setTestingTodoCategory(null);
      }
    });
  }

  function completeTestTodo() {
    if (!lastTestTaskId) {
      setError('请先创建一条测试待办。');
      return;
    }
    setMessage('');
    setError('');
    setCompletingTodo(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-resources/admin/settings/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test-todo-complete', taskId: lastTestTaskId }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(getErrorMessage(body, '测试待办完成失败'));
          return;
        }
        setMessage(`测试待办 ${lastTestTaskId} 已完成。`);
        setLastTestTaskId(null);
      } finally {
        setCompletingTodo(false);
      }
    });
  }

  return (
    <div className="dingtalk-settings">
      <div className="dingtalk-settings-block">
        <h2>通知类别</h2>
        <p className="subtle">
          每类通知可独立启用或停用。测试按钮只向当前管理员发送示例消息，不受对应开关影响。
        </p>
        <div className="dingtalk-notification-list">
          {NOTIFICATION_DEFINITIONS.map((definition) => {
            const enabled = notifications[definition.category];
            const testing = testingCategory === definition.category;
            return (
              <article className="dingtalk-notification-card" key={definition.category}>
                <div className="dingtalk-notification-card-head">
                  <div>
                    <h3>{definition.title}</h3>
                    <p className="subtle">{definition.description}</p>
                  </div>
                  <label className="dingtalk-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={pending}
                      onChange={(event) => save(definition.category, event.target.checked)}
                    />
                    <span>{enabled ? '已开启' : '已关闭'}</span>
                  </label>
                </div>
                <div className="dingtalk-notification-card-foot">
                  <span className="subtle">受众：{definition.audience}</span>
                  <button
                    type="button"
                    className="button"
                    disabled={pending || testing}
                    onClick={() => sendTest(definition.category)}
                  >
                    {testing ? '发送中…' : '测试通知'}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pending || testingTodoCategory === definition.category}
                    onClick={() => sendTestTodo(definition.category)}
                  >
                    {testingTodoCategory === definition.category ? '创建中…' : '测试待办'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="dingtalk-settings-block">
        <h2>测试工具</h2>
        <p className="subtle">
          完成最近一次创建的测试待办（与正式待办相同的完成流程，末尾标记【测试】）。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="button"
            disabled={pending || completingTodo || !lastTestTaskId}
            onClick={() => void completeTestTodo()}
          >
            {completingTodo ? '完成中…' : '完成最近测试待办'}
          </button>
          {lastTestTaskId ? (
            <span className="subtle">当前待办 taskId：{lastTestTaskId}</span>
          ) : (
            <span className="subtle">尚未创建测试待办</span>
          )}
        </div>
      </div>

      {message ? <p className="dingtalk-feedback ok">{message}</p> : null}
      {error ? <p className="dingtalk-feedback bad">{error}</p> : null}
    </div>
  );
}
