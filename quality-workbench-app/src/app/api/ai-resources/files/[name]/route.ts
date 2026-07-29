import { readFile, stat } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { isSafeStoredFileName, resolveAiResourceUploadPath } from '@/modules/ai-resources/upload-files';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  try {
    await requireAiResourceUserApi();

    const { name } = await context.params;
    const storedName = decodeURIComponent(name);
    if (!isSafeStoredFileName(storedName)) {
      return NextResponse.json({ error: '非法文件名。' }, { status: 400 });
    }

    const filePath = await resolveAiResourceUploadPath(storedName);
    if (!filePath) {
      return NextResponse.json({ error: '文件不存在。' }, { status: 404 });
    }

    const [info, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
    const downloadName = request.nextUrl.searchParams.get('name') || storedName;

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(info.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
