import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dingtalkNotifyEnvStatus } from '@/lib/dingtalk/config';
import { sendTestNotifyToUser } from '@/lib/dingtalk/notify-review';
import { isPublishNotifyEnabled, setPublishNotifyEnabled } from '@/lib/dingtalk/settings';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';

const putSchema = z.object({
  publishNotifyEnabled: z.boolean(),
});

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');
    const env = dingtalkNotifyEnvStatus();
    let publishNotifyEnabled = false;
    try {
      publishNotifyEnabled = await isPublishNotifyEnabled();
    } catch (error) {
      console.error('[dingtalk] read publishNotify setting failed:', error);
    }
    return NextResponse.json({
      publishNotifyEnabled,
      env,
      audience: 'app_members',
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const payload = putSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    await setPublishNotifyEnabled(payload.data.publishNotifyEnabled, actor.userId);
    return NextResponse.json({
      publishNotifyEnabled: payload.data.publishNotifyEnabled,
      env: dingtalkNotifyEnvStatus(),
      audience: 'app_members',
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== 'test') {
      return NextResponse.json({ error: '未知操作。' }, { status: 400 });
    }

    const result = await sendTestNotifyToUser(actor.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? '发送失败' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
