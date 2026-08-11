import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { putFeedbackObject, removeFeedbackObject } from '@/lib/storage';
import { getSession } from '@/platform/auth/auth.config';
import {
  FEEDBACK_MAX_ATTACHMENTS,
  FEEDBACK_MAX_CONTENT_LENGTH,
  isFeedbackApplication,
} from '@/lib/feedback/constants';
import { detectFeedbackImageType, feedbackFileError } from '@/lib/feedback/validation';

export const runtime = 'nodejs';

type StoredFeedbackAttachment = {
  name: string;
  storedName: string;
  size: number;
  type: string;
};

const extensionByType: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '反馈数据格式无效。' }, { status: 400 });
  }

  const content = String(formData.get('content') ?? '').trim();
  if (!content) return NextResponse.json({ error: '请填写反馈内容。' }, { status: 400 });
  if (content.length > FEEDBACK_MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `反馈内容不能超过 ${FEEDBACK_MAX_CONTENT_LENGTH} 个字符。` },
      { status: 400 },
    );
  }

  const applicationValue = String(formData.get('application') ?? '').trim();
  if (applicationValue && !isFeedbackApplication(applicationValue)) {
    return NextResponse.json({ error: '关联应用无效。' }, { status: 400 });
  }

  const pagePathValue = String(formData.get('pagePath') ?? '').trim();
  const pagePath = pagePathValue.startsWith('/') ? pagePathValue.slice(0, 500) : null;
  const files = formData.getAll('files').filter((file): file is File => file instanceof File);
  if (files.length > FEEDBACK_MAX_ATTACHMENTS) {
    return NextResponse.json(
      { error: `最多上传 ${FEEDBACK_MAX_ATTACHMENTS} 张图片。` },
      { status: 400 },
    );
  }

  const validatedFiles: Array<{ file: File; type: string }> = [];
  for (const file of files) {
    const error = feedbackFileError(file);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const detectedType = await detectFeedbackImageType(file);
    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json({ error: `${file.name} 图片格式校验失败。` }, { status: 400 });
    }
    validatedFiles.push({ file, type: detectedType });
  }

  const storedNames: string[] = [];
  const attachments: StoredFeedbackAttachment[] = [];
  try {
    for (const { file, type } of validatedFiles) {
      const storedName = `${randomUUID()}${extensionByType[type]}`;
      await putFeedbackObject(
        storedName,
        Buffer.from(await file.arrayBuffer()),
        file.size,
        type,
      );
      storedNames.push(storedName);
      attachments.push({
        name: file.name.slice(0, 260),
        storedName,
        size: file.size,
        type,
      });
    }

    const feedback = await db.feedbackLog.create({
      data: {
        userId: session.sub,
        content,
        application: applicationValue || null,
        pagePath,
        attachments: JSON.stringify(attachments),
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      feedback: {
        id: feedback.id,
        createdAt: feedback.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(storedNames.map((storedName) => removeFeedbackObject(storedName)));
    console.error('[feedback] create failed', error);
    return NextResponse.json({ error: '反馈提交失败，请稍后重试。' }, { status: 500 });
  }
}
