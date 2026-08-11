import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePlatformAppPage } from '@/platform/apps/access';

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ app: string }>;
}) {
  const { app } = await params;
  const appId = app.toLowerCase();
  const { app: platformApp } = await requirePlatformAppPage(
    appId,
    `/portal/coming-soon/${appId}`,
  );
  if (platformApp.state !== 'coming-soon') notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-white p-8 text-center shadow-sm">
        <Link
          href="/portal"
          className="mb-8 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回应用选择
        </Link>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Construction className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">{platformApp.title} 功能搭建中</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {platformApp.title} 应用正在搭建中，后续开放使用。
        </p>
        <span className="mt-5 inline-flex rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          测试应用
        </span>
      </div>
    </div>
  );
}
