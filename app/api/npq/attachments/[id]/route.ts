import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { getAiResourceObject, isStorageNotFound } from '@/lib/storage';
import { getSession } from '@/platform/auth/auth.config';
import { db } from '@/lib/database';
import { canAccessProject } from '@/lib/db/activities';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const attachment = await db.activityAttachment.findUnique({ where: { id } });
  if (!attachment || attachment.deletedAt) {
    return NextResponse.json({ error: '附件不存在' }, { status: 404 });
  }
  const allowed = await canAccessProject(attachment.projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  try {
    const stream = await getAiResourceObject(attachment.storagePath);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'content-type': attachment.mimeType || 'application/octet-stream',
        'content-length': String(attachment.sizeBytes),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
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
