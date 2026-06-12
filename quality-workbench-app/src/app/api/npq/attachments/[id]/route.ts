import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { canAccessProject } from '@/lib/db/activities';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const attachment = await prisma.activityAttachment.findUnique({ where: { id } });
  if (!attachment || attachment.deletedAt) return NextResponse.json({ error: '附件不存在' }, { status: 404 });
  const allowed = await canAccessProject(attachment.projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const bytes = await fs.readFile(attachment.storagePath);
  return new NextResponse(bytes, {
    headers: {
      'content-type': attachment.mimeType || 'application/octet-stream',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    },
  });
}
