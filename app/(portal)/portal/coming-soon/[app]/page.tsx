import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/platform/auth/auth.config';

const appNames: Record<string, string> = {
  ems: 'EMS',
  lab: '实验室',
  pqm: 'PQM',
  qcm: 'QCM',
  sqm: 'SQM',
};

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ app: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { app } = await params;
  const appName = appNames[app.toLowerCase()];
  if (!appName) notFound();

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
        <h1 className="mt-5 text-xl font-semibold text-foreground">{appName} 功能搭建中</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {appName} 应用正在搭建中，后续开放使用。
        </p>
        <span className="mt-5 inline-flex rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          测试应用
        </span>
      </div>
    </div>
  );
}
