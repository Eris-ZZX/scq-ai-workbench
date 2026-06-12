import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { canAccessProject } from '@/lib/db/activities';
import { canMaintainActivityChild } from '@/lib/db/npq-permissions';

const uploadRoot = path.join(process.cwd(), 'uploads', 'activity-attachments');

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: childId } = await params;
  const child = await prisma.projectActivityChild.findUnique({ where: { id: childId }, select: { projectId: true } });
  if (!child) return NextResponse.json({ error: '子任务不存在' }, { status: 404 });
  const allowed = await canAccessProject(child.projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const attachments = await prisma.activityAttachment.findMany({
    where: { childId, deletedAt: null },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(attachments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: childId } = await params;
  const permission = await canMaintainActivityChild({ session, childId });
  if (!permission.child) return NextResponse.json({ error: '子任务不存在' }, { status: 404 });
  if (!permission.allowed) return NextResponse.json({ error: '无权上传附件' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择文件' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '附件不能超过 10MB' }, { status: 413 });

  await fs.mkdir(uploadRoot, { recursive: true });
  const ext = path.extname(file.name).replace(/[^.\w-]/g, '');
  const storedName = `${randomUUID()}${ext}`;
  const storagePath = path.join(uploadRoot, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, bytes);

  const attachment = await prisma.activityAttachment.create({
    data: {
      projectId: permission.child.projectId,
      childId,
      fileName: file.name,
      storagePath,
      mimeType: file.type || null,
      sizeBytes: file.size,
      uploadedById: session.sub,
    },
  });
  await prisma.activityEvent.create({
    data: {
      projectId: permission.child.projectId,
      childId,
      actorUserId: session.sub,
      actorRole: session.role === 'admin' ? 'NPQ' : permission.child.ownerRole,
      actionType: 'upload_attachment',
      afterValue: JSON.stringify({ attachmentId: attachment.id, fileName: attachment.fileName }),
    },
  });
  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: childId } = await params;
  const permission = await canMaintainActivityChild({ session, childId });
  if (!permission.child) return NextResponse.json({ error: '子任务不存在' }, { status: 404 });
  if (!permission.allowed) return NextResponse.json({ error: '无权删除附件' }, { status: 403 });

  const url = new URL(request.url);
  const attachmentId = url.searchParams.get('attachmentId');
  const reason = url.searchParams.get('reason') || '删除附件';
  if (!attachmentId) return NextResponse.json({ error: '缺少附件 ID' }, { status: 400 });

  const attachment = await prisma.activityAttachment.findFirst({
    where: { id: attachmentId, childId, projectId: permission.child.projectId, deletedAt: null },
  });
  if (!attachment) return NextResponse.json({ error: '附件不存在' }, { status: 404 });

  const deleted = await prisma.activityAttachment.update({
    where: { id: attachment.id },
    data: { deletedAt: new Date(), deletedById: session.sub, deleteReason: reason },
  });
  await prisma.activityEvent.create({
    data: {
      projectId: permission.child.projectId,
      childId,
      actorUserId: session.sub,
      actorRole: session.role === 'admin' ? 'NPQ' : permission.child.ownerRole,
      actionType: 'delete_attachment',
      afterValue: JSON.stringify({ attachmentId, fileName: deleted.fileName, reason }),
    },
  });
  return NextResponse.json({ ok: true });
}
