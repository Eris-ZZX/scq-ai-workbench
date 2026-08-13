import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePlatformAppPage } from '@/platform/apps/access';
import { getExternalAppConnection, getExternalAppLaunchEndpoint } from '@/platform/sso/external-connection';
import { issueLaunchCode } from '@/platform/sso/launch-code';

export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default async function ExternalAppLauncherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { app, principal } = await requirePlatformAppPage(id, `/portal/external-apps/${id}`);

  if (app.launchMode !== 'external-sso') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ws-content-bg px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">应用启动方式不匹配</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            该应用不是 SSO 外挂应用，请从应用管理中检查启动方式配置。
          </p>
          <Link className="mt-5 inline-flex text-sm text-primary hover:underline" href="/portal">
            返回应用选择
          </Link>
        </section>
      </main>
    );
  }

  let launchEndpoint: string;
  let code: string;
  try {
    const connection = await getExternalAppConnection(app.id);
    if (!connection.enabled) throw new Error('external application is disabled');
    launchEndpoint = getExternalAppLaunchEndpoint(connection.launchUrl);
    code = await issueLaunchCode(principal.sub, app.id);
  } catch (error) {
    console.error('[platform-sso] external app launch unavailable', {
      appId: app.id,
      error,
    });
    return (
      <main className="flex min-h-screen items-center justify-center bg-ws-content-bg px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">{app.title}暂不可用</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            独立应用尚未完成部署配置，请联系平台管理员。
          </p>
          <Link className="mt-5 inline-flex text-sm text-primary hover:underline" href="/portal">
            返回应用选择
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ws-content-bg px-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">正在进入{app.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          工作台将通过一次性短时登录凭据打开独立应用，不会共享工作台会话。
        </p>
        <form className="mt-5" action={launchEndpoint} method="post">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="next" value="/" />
          <button
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            type="submit"
          >
            继续进入
          </button>
        </form>
        <Link className="mt-4 inline-flex text-sm text-muted-foreground hover:text-primary" href="/portal">
          返回应用选择
        </Link>
      </section>
    </main>
  );
}
