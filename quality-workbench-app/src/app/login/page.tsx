import { redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';

const TEST_ACCOUNTS = ['npq', 'NPQ2', 'pqe', 'sqe', 'fae', 'ram', 'qcm', 'manager', 'admin'];
const TEST_PASSWORD = 'qe123456';

type SearchParams = Record<string, string | string[] | undefined>;

function hasParam(params: SearchParams, key: string, value: string) {
  const current = params[key];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

function dingtalkErrorMessage(params: SearchParams): string | null {
  if (hasParam(params, 'error', 'dingtalk')) return '钉钉登录失败，请重试';
  if (hasParam(params, 'error', 'dingtalk_csrf')) return '安全校验失败，请重新登录';
  if (hasParam(params, 'error', 'dingtalk_token')) return '钉钉授权已过期，请重新扫码';
  if (hasParam(params, 'error', 'dingtalk_disabled')) return '该钉钉账号已被禁用，请联系管理员';
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getSession();
  if (session) redirect('/workbench');

  const params = (await searchParams) ?? {};
  const registered = hasParam(params, 'registered', '1');
  const loginError = hasParam(params, 'error', '1');
  const dtError = dingtalkErrorMessage(params);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-md">
        <form action="/api/auth/login" method="post">
          <h1 className="mb-1 text-2xl font-semibold text-foreground">登录</h1>
          <p className="mb-6 text-sm text-muted-foreground">进入质量项目工作台</p>

          {registered && (
            <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">注册成功，请登录。</div>
          )}
          {loginError && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">登录失败，请检查用户名和密码。</div>
          )}
          {dtError && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{dtError}</div>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-muted-foreground">用户名</span>
            <input
              name="username"
              type="text"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoComplete="username"
              required
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-medium text-muted-foreground">密码</span>
            <input
              name="password"
              type="password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            登录
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">或</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <a
          href="/api/auth/dingtalk"
          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#0089FF" />
            <path d="M18.5 7.5L10.5 15.5L5.5 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          钉钉扫码登录
        </a>

        <div className="mt-5 rounded-md bg-muted/50 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">测试账号，点击直接登录</div>
          <div className="flex flex-wrap gap-1">
            {TEST_ACCOUNTS.map((account) => (
              <form key={account} action="/api/auth/login" method="post" className="contents">
                <input type="hidden" name="username" value={account} readOnly />
                <input type="hidden" name="password" value={TEST_PASSWORD} readOnly />
                <button
                  type="submit"
                  className="rounded border border-border bg-white px-2 py-1 font-mono text-xs text-foreground hover:border-primary"
                >
                  {account}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
