import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueExternalJob, getLatestExternalJob } from '@/lib/external-jobs';
import { getDirectorySyncStatus } from '@/lib/dws/directory-sync';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

export async function GET() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({
    status: await getDirectorySyncStatus(),
    job: await getLatestExternalJob('directory.sync'),
  });
}

export async function POST() {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const activeJob = await getLatestExternalJob('directory.sync');
  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing')) {
    return NextResponse.json({ error: '组织目录同步正在排队或执行中，请稍后再试。' }, { status: 409 });
  }

  const job = await enqueueExternalJob({
    kind: 'directory.sync',
    idempotencyKey: `directory.sync:${randomUUID()}`,
    payload: {
      actorId: auth.session.sub,
      actorUsername: auth.session.username,
    },
  });
  return NextResponse.json({
    status: 'queued',
    jobId: job.id,
    message: '组织目录同步任务已创建，将由独立 DWS Worker 执行。',
  }, { status: 202 });
}
