'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DingTalkNotifyEnvStatus } from '@/lib/dingtalk/config';
import type { DingTalkNotificationCategory } from '@/lib/dingtalk/settings';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type NotificationSettings = Record<DingTalkNotificationCategory, boolean>;

type Props = {
  initialNotifications: NotificationSettings;
  initialEnv: DingTalkNotifyEnvStatus;
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
    audience: '已绑定钉钉的 AI 资源库成员',
  },
];

export function AdminDingTalkPanel({ initialNotifications, initialEnv }: Props) {
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotifications);
  const [env, setEnv] = useState<DingTalkNotifyEnvStatus>(initialEnv);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingCategory, setTestingCategory] = useState<DingTalkNotificationCategory | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/ai-resources/admin/settings/dingtalk', { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(getErrorMessage(body, '加载钉钉配置失败'));
      return;
    }
    if (body.notifications) {
      setNotifications(body.notifications);
    }
    if (body.env) setEnv(body.env);
    setError('');
  }

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, []);

  function save(category: DingTalkNotificationCategory, next: boolean) {
    setMessage('');
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/ai-resources/admin/settings/dingtalk', {
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
      if (body.env) setEnv(body.env);
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
        const res = await fetch('/api/ai-resources/admin/settings/dingtalk', {
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
        setMessage(`${definition?.title ?? '通知'}测试消息已发送，请在钉钉「工作通知」中查看。`);
      } finally {
        setTestingCategory(null);
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
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="dingtalk-settings-block">
        <h2>环境检查</h2>
        <ul className="dingtalk-env-list">
          <li className={env.hasCredentials ? 'ok' : 'bad'}>
            DINGTALK_CLIENT_ID / SECRET：{env.hasCredentials ? '已配置' : '未配置'}
          </li>
          <li className={env.hasAgentId ? 'ok' : 'bad'}>
            DINGTALK_AGENT_ID：{env.hasAgentId ? '已配置' : '未配置'}
          </li>
          <li className={env.hasAppBaseUrl ? 'ok' : 'bad'}>
            APP_BASE_URL：{env.hasAppBaseUrl ? '已配置' : '未配置'}
          </li>
        </ul>
        <p className="subtle">
          登录用的 Client ID/Secret 可复用；还需补 AgentId 与 APP_BASE_URL。修改 `.env` 后请重启
          `npm run dev`。开放平台需开通待办写权限与工作通知权限。
        </p>
      </div>

      {message ? <p className="dingtalk-feedback ok">{message}</p> : null}
      {error ? <p className="dingtalk-feedback bad">{error}</p> : null}
    </div>
  );
}
