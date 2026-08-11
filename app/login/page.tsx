import { redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';
import { authingEnabled, authingRequired } from '@/platform/auth/authing.config';
import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';
import { resolveReturnPath } from '@/platform/auth/return-path';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(params: SearchParams, key: string) {
  const current = params[key];
  return Array.isArray(current) ? current[0] : current;
}

function hasParam(params: SearchParams, key: string, value: string) {
  const current = params[key];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

function authingErrorMessage(params: SearchParams): string | null {
  if (hasParam(params, 'error', 'authing')) return 'Authing 登录失败，请重试';
  if (hasParam(params, 'error', 'authing_state')) return '安全校验失败，请重新登录';
  if (hasParam(params, 'error', 'disabled')) return '该账号已被禁用，请联系管理员';
  if (hasParam(params, 'error', 'identity_conflict')) return 'Authing 身份绑定存在冲突，请联系管理员';
  if (hasParam(params, 'error', 'authing_config')) return 'Authing 登录服务尚未配置，请联系管理员';
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const next = resolveReturnPath(firstParam(params, 'next'), DEFAULT_AFTER_LOGIN);

  const session = await getSession();
  if (session) redirect(next);

  const loginError = hasParam(params, 'error', '1');
  const authingError = authingErrorMessage(params);
  const authingHref =
    next && next !== DEFAULT_AFTER_LOGIN
      ? `/api/auth/authing?next=${encodeURIComponent(next)}`
      : '/api/auth/authing';
  const oidcEnabled = authingEnabled();
  const localLoginAllowed = !oidcEnabled && !authingRequired();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">登录</h1>
        <p className="mb-6 text-sm text-muted-foreground">进入质量项目工作台</p>

        {loginError && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">本地登录失败，请重试。</div>
        )}
        {authingError && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{authingError}</div>
        )}

        {oidcEnabled ? (
          <a
            href={authingHref}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            使用 Authing 单点登录
          </a>
        ) : localLoginAllowed ? (
          <form action="/api/auth/login" method="post">
            <input type="hidden" name="next" value={next} />

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
              开发环境本地登录
            </button>
          </form>
        ) : (
          <div className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            Authing 登录未配置，生产环境已拒绝本地登录。
          </div>
        )}

        {oidcEnabled && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            身份认证由 Authing 提供，角色和权限由 NPQ 工作台本地维护。
          </p>
        )}
      </div>
    </div>
  );
}
