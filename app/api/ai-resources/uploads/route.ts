import { randomUUID } from 'crypto';
import { extname } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { putAiResourceObject } from '@/lib/storage';
import {
  AI_UPLOAD_MAX_ATTACHMENTS,
  AI_UPLOAD_MAX_FILE_SIZE_BYTES,
  AI_UPLOAD_MAX_FILE_SIZE_LABEL,
  AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES,
  AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL,
} from '@/modules/ai-resources/constants';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { isHtmlFileName } from '@/modules/ai-resources/hosted-html';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAiResourceUserApi();

    const formData = await request.formData();
    const purpose = String(formData.get('purpose') ?? '').trim();
    const htmlOnly = purpose === 'hosted-html';
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: '请选择要上传的附件。' }, { status: 400 });
    }

    if (htmlOnly && files.length !== 1) {
      return NextResponse.json({ error: '托管 HTML 只能上传一个文件。' }, { status: 400 });
    }

    if (!htmlOnly && files.length > AI_UPLOAD_MAX_ATTACHMENTS) {
      return NextResponse.json(
        { error: `一次最多上传 ${AI_UPLOAD_MAX_ATTACHMENTS} 个附件。` },
        { status: 400 },
      );
    }

    for (const file of files) {
      const maxBytes = htmlOnly ? AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES : AI_UPLOAD_MAX_FILE_SIZE_BYTES;
      const maxLabel = htmlOnly ? AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL : AI_UPLOAD_MAX_FILE_SIZE_LABEL;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: `${file.name} 超过 ${maxLabel}，无法上传。` },
          { status: 413 },
        );
      }
      if (htmlOnly && !isHtmlFileName(file.name)) {
        return NextResponse.json({ error: '仅支持上传 .html / .htm 文件。' }, { status: 400 });
      }
    }

    const attachments = [];
    for (const file of files) {
      const extension = extname(file.name) || (htmlOnly ? '.html' : '');
      const storedName = `${randomUUID()}${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await putAiResourceObject(
        storedName,
        bytes,
        file.size,
        file.type || (htmlOnly ? 'text/html' : 'application/octet-stream'),
      );

      attachments.push({
        name: file.name,
        url: `/api/ai-resources/files/${storedName}`,
        size: file.size,
        type: file.type || (htmlOnly ? 'text/html' : 'application/octet-stream'),
        storedName,
      });
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
