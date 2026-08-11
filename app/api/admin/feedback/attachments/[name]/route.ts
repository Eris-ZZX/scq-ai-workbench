import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getFeedbackObject, isStorageNotFound } from '@/lib/storage';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name } = await params;
  const rows = await db.feedbackLog.findMany({
    where: { attachments: { contains: name } },
    take: 20,
  });
  const attachment = rows
    .flatMap((row) => parseAttachments(row.attachments))
    .find((item) => item.storedName === name);
  if (!attachment) return NextResponse.json({ error: '附件不存在' }, { status: 404 });

  try {
    const stream = await getFeedbackObject(name);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'content-type': attachment.type,
        'content-length': String(attachment.size),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    if (isStorageNotFound(error)) {
      return NextResponse.json({ error: '附件不存在' }, { status: 404 });
    }
    throw error;
  }
}

function parseAttachments(value: unknown) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is {
      name: string;
      storedName: string;
      size: number;
      type: string;
    } => (
      item &&
      typeof item.name === 'string' &&
      typeof item.storedName === 'string' &&
      typeof item.size === 'number' &&
      typeof item.type === 'string'
    ));
  } catch {
    return [];
  }
}
