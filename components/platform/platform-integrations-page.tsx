'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';

type ConnectionView = {
  appId: string;
  displayName: string;
  launchUrl: string;
  note: string;
  enabled: boolean;
  secretConfigured: boolean;
  secretHint: string;
  source: 'database' | 'environment' | 'default';
  updatedAt: string | null;
};

type ConnectionResponse = {
  connection: ConnectionView;
};

const sourceLabels: Record<ConnectionView['source'], string> = {
  database: '数据库配置',
  environment: '环境变量 fallback',
  default: '开发默认值',
};

function formatUpdatedAt(value: string | null) {
  if (!value) return '尚未保存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN', { hour12: false });
}

export default function PlatformIntegrationsPage() {
  const [connection, setConnection] = useState<ConnectionView | null>(null);
  const [launchUrl, setLaunchUrl] = useState('');
  const [note, setNote] = useState('');
  const [exchangeSecret, setExchangeSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-integrations', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as ConnectionResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'error' in body ? body.error : '外挂应用连接配置加载失败。');
      }
      const value = (body as ConnectionResponse).connection;
      setConnection(value);
      setLaunchUrl(value.launchUrl);
      setNote(value.note || '');
      setEnabled(value.enabled);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '外挂应用连接配置加载失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          launchUrl,
          note,
          exchangeSecret,
          enabled,
        }),
      });
      const body = await response.json().catch(() => null) as ConnectionResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'error' in body ? body.error : '外挂应用连接配置保存失败。');
      }
      const value = (body as ConnectionResponse).connection;
      setConnection(value);
      setLaunchUrl(value.launchUrl);
      setNote(value.note || '');
      setEnabled(value.enabled);
      setExchangeSecret('');
      setMessage('外挂应用连接配置已保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '外挂应用连接配置保存失败。');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/platform-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || '外挂应用连接测试失败。');
      }
      setMessage(body?.message || '图纸可靠性应用连接正常。');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '外挂应用连接测试失败。');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="rounded-md border border-border bg-white p-8 text-sm text-muted-foreground">加载外挂应用连接配置...</div>;
  }

  return (
    <section className="rounded-md border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {connection?.displayName || '图纸可靠性匹配'}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          管理独立部署应用的入口地址和服务端兑换密钥。密钥仅保存加密后的密文，不会在页面回显。
        </p>
      </div>

      {error && <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mx-5 mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      <div className="space-y-4 p-5">
        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          应用 ID：<code className="font-mono text-foreground">{connection?.appId || 'sqm-drawing-reliability'}</code>
          <span className="mx-2">·</span>
          当前来源：{connection ? sourceLabels[connection.source] : '-'}
          <span className="mx-2">·</span>
          最近更新：{formatUpdatedAt(connection?.updatedAt || null)}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">独立应用地址</span>
          <input
            value={launchUrl}
            onChange={(event) => setLaunchUrl(event.target.value)}
            className="h-10 w-full rounded-md border border-border px-3 font-mono text-sm outline-none focus:border-primary"
            placeholder="https://drawing-test.example.com"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            浏览器将通过该地址向图纸仓库提交一次性 launch code。生产环境必须使用 HTTPS。
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">兑换密钥</span>
          <input
            type="password"
            value={exchangeSecret}
            onChange={(event) => setExchangeSecret(event.target.value)}
            className="h-10 w-full rounded-md border border-border px-3 font-mono text-sm outline-none focus:border-primary"
            placeholder={connection?.secretConfigured ? '留空表示保留现有密钥' : '录入与图纸仓库相同的独立密钥'}
            autoComplete="new-password"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {connection?.secretConfigured
              ? `当前已配置（${connection.secretHint || '已隐藏'}），留空不会修改。`
              : '尚未配置；启用连接前必须录入。'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">连接备注</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="例如：测试服务器图纸仓库"
            maxLength={500}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          启用图纸可靠性入口
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing || saving || !connection?.secretConfigured || !enabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            测试连接
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存连接配置
          </button>
        </div>
      </div>
    </section>
  );
}
