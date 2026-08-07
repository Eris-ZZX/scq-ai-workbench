import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/database';
import {
  completeTestTodo,
  sendTestNotifyToUser,
  sendTestTodoToUser,
} from '@/lib/dingtalk/notify-review';
import {
  DINGTALK_NOTIFICATION_CATEGORIES,
  getDingTalkNotificationSettings,
  setDingTalkNotificationEnabled,
  type DingTalkNotificationCategory,
} from '@/lib/dingtalk/settings';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import {
  AI_RESOURCE_AUDIT_ACTIONS,
  appendAiResourceAuditLog,
  getAuditRequestContext,
} from '@/modules/ai-resources/audit';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';

const categorySchema = z.enum(DINGTALK_NOTIFICATION_CATEGORIES);
const putSchema = z.object({
  category: categorySchema.optional(),
  enabled: z.boolean().optional(),
  // 兼容旧版管理页请求
  publishNotifyEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');
    const notifications = await getDingTalkNotificationSettings();
    return NextResponse.json({
      notifications,
      publishNotifyEnabled: notifications.publish,
      audience: 'app_members',
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const auditContext = getAuditRequestContext(request);
    const payload = putSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const category =
      payload.data.category ??
      (payload.data.publishNotifyEnabled === undefined ? undefined : 'publish');
    const enabled = payload.data.enabled ?? payload.data.publishNotifyEnabled;
    if (!category || enabled === undefined) {
      return NextResponse.json({ error: '缺少通知类别或开关状态。' }, { status: 400 });
    }

    const beforeSettings = await getDingTalkNotificationSettings();
    await db.$transaction(async (tx) => {
      await setDingTalkNotificationEnabled(
        category as DingTalkNotificationCategory,
        enabled,
        actor.userId,
        tx,
      );
      await appendAiResourceAuditLog({
        actorId: actor.userId,
        actorUsername: actor.username,
        action: AI_RESOURCE_AUDIT_ACTIONS.EXTERNAL_NOTIFICATIONS_SETTINGS_UPDATE,
        targetType: 'EXTERNAL_NOTIFICATIONS_SETTINGS',
        targetId: category,
        result: 'SUCCESS',
        before: { category, enabled: beforeSettings[category as DingTalkNotificationCategory] },
        after: { category, enabled },
        ...auditContext,
      }, tx);
    });
    const notifications = await getDingTalkNotificationSettings();
    return NextResponse.json({
      notifications,
      publishNotifyEnabled: notifications.publish,
      audience: 'app_members',
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const auditContext = getAuditRequestContext(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      category?: string;
      taskId?: string;
    };
    const category = body.category
      ? categorySchema.safeParse(body.category)
      : { success: true as const, data: 'publish' as const };
    if (!category.success) {
      return NextResponse.json({ error: '通知类别无效。' }, { status: 400 });
    }

    let result: { ok: boolean; error?: string; taskId?: string };
    if (body.action === 'test-todo') {
      result = await sendTestTodoToUser(actor.userId, category.data);
    } else if (body.action === 'test-todo-complete') {
      if (!body.taskId) {
        return NextResponse.json({ error: '缺少待办 taskId。' }, { status: 400 });
      }
      result = await completeTestTodo(body.taskId, actor.userId);
    } else if (body.action === 'test') {
      result = await sendTestNotifyToUser(actor.userId, category.data);
    } else {
      return NextResponse.json({ error: '未知操作。' }, { status: 400 });
    }

    if (!result.ok) {
      await appendAiResourceAuditLog({
        actorId: actor.userId,
        actorUsername: actor.username,
        action: AI_RESOURCE_AUDIT_ACTIONS.EXTERNAL_NOTIFICATIONS_TEST,
        targetType: 'EXTERNAL_NOTIFICATIONS_SETTINGS',
        targetId: category.data,
        result: 'FAILED',
        reason: result.error ?? '操作失败',
        after: { category: category.data, audience: 'self', action: body.action },
        ...auditContext,
      }).catch(() => undefined);
      return NextResponse.json({ error: result.error ?? '操作失败' }, { status: 400 });
    }
    await appendAiResourceAuditLog({
      actorId: actor.userId,
      actorUsername: actor.username,
      action: AI_RESOURCE_AUDIT_ACTIONS.EXTERNAL_NOTIFICATIONS_TEST,
      targetType: 'EXTERNAL_NOTIFICATIONS_SETTINGS',
      targetId: category.data,
      result: 'SUCCESS',
      reason: '管理员手动发送测试通知',
      after: { category: category.data, audience: 'self', action: body.action },
      ...auditContext,
    });
    return NextResponse.json({ ok: true, taskId: result.taskId ?? null });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
