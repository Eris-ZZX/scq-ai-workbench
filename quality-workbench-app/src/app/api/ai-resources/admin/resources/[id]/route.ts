import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scheduleResourceBroadcast } from '@/lib/dingtalk/notify-review';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { AiResourceError, aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { diffKeys } from '@/modules/ai-resources/policy';
import { toDbResourceData } from '@/modules/ai-resources/resource-data';
import { archiveResourceSchema, resourceUpdateBodySchema } from '@/modules/ai-resources/validation';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const { id } = await context.params;

    const existing = await prisma.aiResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }

    const payload = resourceUpdateBodySchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const proposedData = {
      name: payload.data.resource.name,
      type: payload.data.resource.type,
      summary: payload.data.resource.summary,
      tags: payload.data.resource.tags,
      ownerName: payload.data.resource.ownerName,
      visibilityScope: payload.data.resource.visibilityScope,
      status: payload.data.resource.status,
      resourceUrl: payload.data.resource.resourceUrl || null,
      content: payload.data.resource.content,
      attachments: payload.data.resource.attachments,
      extractedText: payload.data.resource.extractedText,
      extension: payload.data.resource.extension,
    };

    const changedFields = diffKeys(
      {
        name: existing.name,
        type: existing.type,
        summary: existing.summary,
        tags: existing.tags,
        ownerName: existing.ownerName,
        visibilityScope: existing.visibilityScope,
        status: existing.status,
        resourceUrl: existing.resourceUrl,
        content: existing.content,
        attachments: existing.attachments,
        extractedText: existing.extractedText,
      },
      proposedData,
    );

    const result = await prisma.$transaction(async (tx) => {
      const resource = await tx.aiResource.update({
        where: { id },
        data: {
          ...toDbResourceData(proposedData),
          currentVersion: { increment: 1 },
        },
      });

      await tx.aiResourceUpdateLog.create({
        data: {
          resourceId: id,
          actorId: actor.userId,
          reviewerId: actor.userId,
          action: 'UPDATE',
          result: 'APPROVED',
          updateSummary: payload.data.updateSummary,
          changedFields: changedFields.join(','),
        },
      });

      return resource;
    });

    scheduleResourceBroadcast({
      kind: 'UPDATE',
      resourceId: result.id,
      name: result.name,
      summary: result.summary,
      type: result.type,
      ownerName: result.ownerName,
      tags: result.tags,
      actorName: actor.username,
      updateSummary: payload.data.updateSummary,
    });

    return NextResponse.json({ resource: result });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const { id } = await context.params;

    const payload = archiveResourceSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const existing = await prisma.aiResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }
    if (payload.data.confirmationName !== existing.name) {
      return NextResponse.json({ error: '确认名称与资源名称不一致。' }, { status: 400 });
    }
    if (existing.status === 'ARCHIVED') {
      return NextResponse.json({ error: '资源已归档。' }, { status: 409 });
    }

    const resource = await prisma.$transaction(async (tx) => {
      const updated = await tx.aiResource.update({
        where: { id },
        data: {
          archivedFromStatus: existing.status,
          status: 'ARCHIVED',
        },
      });

      await tx.aiResourceUpdateLog.create({
        data: {
          resourceId: id,
          actorId: actor.userId,
          reviewerId: actor.userId,
          action: 'ARCHIVE',
          result: 'DONE',
          updateSummary: `归档资源：${existing.name}`,
          changedFields: 'status',
        },
      });

      return updated;
    });

    return NextResponse.json({ resource });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const { id } = await context.params;

    const existing = await prisma.aiResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '资源不存在。' }, { status: 404 });
    }
    const fromStatus = existing.archivedFromStatus;
    if (existing.status !== 'ARCHIVED' || !fromStatus) {
      throw new AiResourceError('资源无法恢复。', 409, 'CANNOT_RESTORE');
    }

    const resource = await prisma.$transaction(async (tx) => {
      const updated = await tx.aiResource.update({
        where: { id },
        data: {
          status: fromStatus,
          archivedFromStatus: null,
        },
      });

      await tx.aiResourceUpdateLog.create({
        data: {
          resourceId: id,
          actorId: actor.userId,
          reviewerId: actor.userId,
          action: 'RESTORE',
          result: 'DONE',
          updateSummary: `恢复资源：${existing.name}`,
          changedFields: 'status',
        },
      });

      return updated;
    });

    return NextResponse.json({ resource });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
