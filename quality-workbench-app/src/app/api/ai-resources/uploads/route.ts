import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await requireAiResourceUserApi();

    const formData = await request.formData();
    const files = formData.getAll('files').filter((file): file is File => file instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: '请选择要上传的附件。' }, { status: 400 });
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `${file.name} 超过 20MB，无法上传。` }, { status: 413 });
      }
    }

    const uploadDir = join(process.cwd(), 'storage', 'ai-resources', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const attachments = await prisma.$transaction(async (tx) => {

      const uploaded = [];
      for (const file of files) {
        const extension = extname(file.name);
        const storedName = `${randomUUID()}${extension}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        await writeFile(join(uploadDir, storedName), bytes);

        uploaded.push({
          name: file.name,
          url: `/api/ai-resources/files/${storedName}`,
          size: file.size,
          type: file.type || 'application/octet-stream',
        });
      }
      return uploaded;
    });

    return NextResponse.json({ attachments });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
