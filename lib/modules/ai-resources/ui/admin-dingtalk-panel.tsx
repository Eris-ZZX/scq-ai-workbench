'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DingTalkNotifyEnvStatus } from '@/lib/dingtalk/config';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type Props = {
  initialEnabled: boolean;
  initialEnv: DingTalkNotifyEnvStatus;
};

export function AdminDingTalkPanel({ initialEnabled, initialEnv }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [env, setEnv] = useState<DingTalkNotifyEnvStatus>(initialEnv);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/ai-resources/admin/settings/dingtalk', { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(getErrorMessage(body, '加载钉钉配置失败'));
      return;
    }
    setEnabled(Boolean(body.publishNotifyEnabled));
    if (body.env) setEnv(body.env);
    setError('');
  }

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, []);

  function save(next: boolean) {
    setMessage('');
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/ai-resources/admin/settings/dingtalk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishNotifyEnabled: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '保存失败'));
        return;
      }
      setEnabled(Boolean(body.publishNotifyEnabled));
      if (body.env) setEnv(body.env);
      setMessage(next ? '已开启上线工作通知。' : '已关闭上线工作通知。');
    });
  }

  function sendTest() {
    setMessage('');
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/ai-resources/admin/settings/dingtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(body, '测试发送失败'));
        return;
      }
      setMessage('测试通知已发送，请在钉钉「工作通知」中查看。');
    });
  }

  return (
    <div className="dingtalk-settings">
      <div className="dingtalk-settings-block">
        <h2>上线广播</h2>
        <p className="subtle">
          新建或更新资源审批通过后，以本企业内部应用身份向已绑定钉钉的模块成员发送工作通知（不发群）。
          未保存过开关时默认开启。
        </p>
        <label className="dingtalk-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(event) => save(event.target.checked)}
          />
          <span>启用审批通过后的工作通知</span>
        </label>
        <p className="subtle">受众：AI 资源库成员中已绑定钉钉企业 userid 的用户。</p>
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
        <button type="button" className="button primary" disabled={pending} onClick={sendTest}>
          发送测试通知给我
        </button>
      </div>

      {message ? <p className="dingtalk-feedback ok">{message}</p> : null}
      {error ? <p className="dingtalk-feedback bad">{error}</p> : null}
    </div>
  );
}
