import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePlatformAppPage } from '@/platform/apps/access';
import { getDrawingReliabilityConnection } from '@/platform/sso/external-connection';
import {
  getDrawingReliabilityLaunchEndpoint,
  issueLaunchCode,
} from '@/platform/sso/launch-code';

export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default async function DrawingReliabilityLauncherPage() {
  const { principal } = await requirePlatformAppPage(
    'sqm-drawing-reliability',
    '/sqm/drawing-reliability',
  );

  let launchEndpoint: string;
  let code: string;
  try {
    const connection = await getDrawingReliabilityConnection();
    if (!connection.enabled) {
      throw new Error('drawing reliability connection is disabled');
    }
    launchEndpoint = getDrawingReliabilityLaunchEndpoint(connection.launchUrl);
    code = await issueLaunchCode(principal.sub);
  } catch (error) {
    console.error('[platform-sso] drawing reliability launch unavailable', error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-ws-content-bg px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">图纸可靠性匹配暂不可用</h1>
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
        <h1 className="text-lg font-semibold text-foreground">正在进入图纸可靠性匹配</h1>
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
