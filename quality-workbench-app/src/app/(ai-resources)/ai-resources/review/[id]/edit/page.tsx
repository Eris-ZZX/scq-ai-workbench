import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { AiResource } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import { fromPrismaJsonObject } from '@/modules/ai-resources/json';
import { canResubmitReview } from '@/modules/ai-resources/policy';
import { ResourceForm } from '@/modules/ai-resources/ui/resource-form';

export default async function ReviewResubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAiResourceUser();
  const { id } = await params;

  const request = await prisma.aiResourceReviewRequest.findUnique({ where: { id } });
  if (!request) notFound();
  if (!canResubmitReview(actor, request)) {
    redirect(`/ai-resources/review/${id}`);
  }
  if (request.type === 'ARCHIVE') {
    redirect(`/ai-resources/review/${id}`);
  }

  const proposed = fromPrismaJsonObject(request.proposedData) as Record<string, unknown>;
  const tags = Array.isArray(proposed.tags)
    ? proposed.tags.join(',')
    : typeof proposed.tags === 'string'
      ? proposed.tags
      : '';

  const draftResource = {
    id: request.resourceId ?? `draft-${request.id}`,
    name: String(proposed.name ?? ''),
    type: String(proposed.type ?? 'AGENT'),
    summary: String(proposed.summary ?? ''),
    tags,
    ownerName: String(proposed.ownerName ?? actor.username),
    visibilityScope: String(proposed.visibilityScope ?? 'ALL'),
    visibleDeptIds: '[]',
    visibleUserIds: '[]',
    status: String(proposed.status ?? 'PUBLISHED'),
    resourceUrl: typeof proposed.resourceUrl === 'string' ? proposed.resourceUrl : null,
    content: String(proposed.content ?? ''),
    attachments:
      typeof proposed.attachments === 'string'
        ? proposed.attachments
        : proposed.attachments != null
          ? JSON.stringify(proposed.attachments)
          : null,
    extension:
      typeof proposed.extension === 'string'
        ? proposed.extension
        : proposed.extension != null
          ? JSON.stringify(proposed.extension)
          : null,
    extractedText: typeof proposed.extractedText === 'string' ? proposed.extractedText : null,
    currentVersion: 1,
    createdById: request.requesterId,
    archivedFromStatus: null,
    legacyId: null,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
  } as AiResource;

  return (
    <main className="main">
      <section className="page-head">
        <div>
          <h1>修改并重新提交</h1>
          <p className="subtle">在原审批单上修改内容后再次提交审批</p>
        </div>
        <Link className="button" href={`/ai-resources/review/${id}`}>
          返回审批单
        </Link>
      </section>

      {request.rejectReason ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>驳回原因</h2>
          <p className="reject-reason" style={{ margin: 0 }}>
            {request.rejectReason}
          </p>
        </section>
      ) : null}

      <section className="panel">
        <ResourceForm
          resource={draftResource}
          resubmitReviewId={request.id}
          initialReviewerId={request.reviewerId}
        />
      </section>
    </main>
  );
}
