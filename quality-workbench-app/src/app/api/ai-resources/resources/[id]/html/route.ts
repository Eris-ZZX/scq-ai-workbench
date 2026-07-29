import { readFile, stat } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { parseHostedHtml } from '@/modules/ai-resources/hosted-html';
import { canViewResource, visibleResourceWhere } from '@/modules/ai-resources/policy';
import { isSafeStoredFileName, resolveAiResourceUploadPath } from '@/modules/ai-resources/upload-files';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAiResourceUserApi();
    const { id } = await context.params;

    const resource = await prisma.aiResource.findFirst({
      where: {
        id,
        AND: [visibleResourceWhere(actor)],
      },
    });

    if (!resource || !canViewResource(actor, resource)) {
      return NextResponse.json({ error: '资源不存在或无权访问。' }, { status: 404 });
    }

    const hosted = parseHostedHtml(resource.extension);
    if (!hosted || !isSafeStoredFileName(hosted.storedName)) {
      return NextResponse.json({ error: '该资源没有可打开的托管 HTML。' }, { status: 404 });
    }

    const filePath = await resolveAiResourceUploadPath(hosted.storedName);
    if (!filePath) {
      return NextResponse.json({ error: 'HTML 文件不存在。' }, { status: 404 });
    }

    const [info, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(info.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(hosted.originalName)}`,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy':
          'sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
