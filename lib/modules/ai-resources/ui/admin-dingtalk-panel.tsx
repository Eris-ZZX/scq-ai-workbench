'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DwsWorkerStatus } from '@/lib/dws/status';
import type { ExternalNotificationCategory } from '@/lib/dingtalk/settings';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type NotificationSettings = Record<ExternalNotificationCategory, boolean>;
type ExternalJobSummary = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

type Props = {
  initialNotifications: NotificationSettings;
  initialWorker: DwsWorkerStatus;
};

const NOTIFICATION_DEFINITIONS: Array<{
  category: ExternalNotificationCategory;
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
    audience: '已匹配 DWS userId 的 AI 资源库成员',
  },
];

export function AdminDingTalkPanel({
  initialNotifications,
  initialWorker,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotifications);
  const [worker, setWorker] = useState<DwsWorkerStatus>(initialWorker);
  const [jobs, setJobs] = useState<ExternalJobSummary[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingCategory, setTestingCategory] = useState<ExternalNotificationCategory | null>(
    null,
  );
  const [testingTodoCategory, setTestingTodoCategory] = useState<ExternalNotificationCategory | null>(
    null,
  );
  const [completingTodo, setCompletingTodo] = useState(false);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/ai-resources/admin/settings/notifications', { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(getErrorMessage(body, '加载外部通知配置失败'));
      return;
    }
    if (body.notifications) {
      setNotifications(body.notifications);
    }
    if (body.worker) setWorker(body.worker);
    if (Array.isArray(body.jobs)) setJobs(body.jobs);
    setError('');
  }

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, []);

  function save(category: ExternalNotificationCategory, next: boolean) {
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
      if (body.worker) setWorker(body.worker);
      if (Array.isArray(body.jobs)) setJobs(body.jobs);
      const definition = NOTIFICATION_DEFINITIONS.find((item) => item.category === category);
      setMessage(`${definition?.title ?? '通知'}已${next ? '开启' : '关闭'}。`);
    });
  }

  function sendTest(category: ExternalNotificationCategory) {
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
        setMessage(`${definition?.title ?? '通知'}测试任务已创建，将由 DWS Worker 投递。`);
      } finally {
        setTestingCategory(null);
      }
    });
  }

  function sendTestTodo(category: ExternalNotificationCategory) {
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
        const definition = NOTIFICATION_DEFINITIONS.find((item) => item.category === category);
        setMessage(`${definition?.title ?? '通知'}测试待办已创建，将由 DWS Worker 投递。`);
      } finally {
        setTestingTodoCategory(null);
      }
    });
  }

  function completeTestTodo() {
    setMessage('');
    setError('');
    setCompletingTodo(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-resources/admin/settings/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test-todo-complete' }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(getErrorMessage(body, '测试待办完成失败'));
          return;
        }
        setMessage('最近一条测试待办已完成。');
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
          完成最近一条已创建的测试待办（与正式待办相同的完成流程，末尾标记【测试】）。
        </p>
        <button
          type="button"
          className="button"
          disabled={pending || completingTodo}
          onClick={() => void completeTestTodo()}
        >
          {completingTodo ? '完成中…' : '完成最近测试待办'}
        </button>
      </div>

      <div className="dingtalk-settings-block">
        <h2>DWS Worker 状态</h2>
        <ul className="dingtalk-env-list">
          <li className={worker.healthy ? 'ok' : 'bad'}>
            Worker 心跳：{worker.healthy ? '正常' : '未连接或已过期'}
          </li>
          <li className={worker.appBaseUrlConfigured ? 'ok' : 'bad'}>
            APP_BASE_URL：{worker.appBaseUrlConfigured ? '已配置' : '未配置'}
          </li>
          <li className="ok">DWS 凭证：仅由独立 Worker 管理</li>
        </ul>
        <p className="subtle">
          Web 服务只创建任务，不读取 DWS 登录态，也不会在请求中启动 dws-cli。
          目录匹配和通知失败会保留在任务列表中，需由 Worker 重试或人工处理。
        </p>
      </div>

      <div className="dingtalk-settings-block">
        <h2>最近外部任务</h2>
        {jobs.length ? (
          <ul className="space-y-2 text-xs">
            {jobs.slice(0, 10).map((job) => (
              <li className="rounded border border-border px-3 py-2" key={job.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{job.kind}</span>
                  <span className={job.status === 'failed' ? 'text-red-700' : job.status === 'succeeded' ? 'text-green-700' : 'text-amber-700'}>
                    {job.status} · 尝试 {job.attempts}
                  </span>
                </div>
                {job.lastError ? <p className="mt-1 text-red-700">{job.lastError}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle">暂无外部任务。</p>
        )}
      </div>

      {message ? <p className="dingtalk-feedback ok">{message}</p> : null}
      {error ? <p className="dingtalk-feedback bad">{error}</p> : null}
    </div>
  );
}
