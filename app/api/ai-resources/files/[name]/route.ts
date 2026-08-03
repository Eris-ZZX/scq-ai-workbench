import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAiResourceObject,
  isStorageNotFound,
  statAiResourceObject,
} from '@/lib/storage';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { isSafeStoredFileName } from '@/modules/ai-resources/upload-files';

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

    let info;
    let stream;
    try {
      [info, stream] = await Promise.all([
        statAiResourceObject(storedName),
        getAiResourceObject(storedName),
      ]);
    } catch (error) {
      if (isStorageNotFound(error)) {
        return NextResponse.json({ error: '文件不存在。' }, { status: 404 });
      }
      throw error;
    }

    const downloadName = request.nextUrl.searchParams.get('name') || storedName;
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
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
