import crypto from 'node:crypto';
import { db } from '@/lib/database';
import { resourceTypeLabel, reviewTypeLabel } from '@/modules/ai-resources/labels';
import type { AiResourceType, AiReviewType } from '@/modules/ai-resources/constants';
import { buildAuthEntryUrl, buildDingTalkPcBrowserUrl, buildNotifyLinks, dingtalkNotifyEnvStatus } from './config';
import {
  isDingTalkNotificationEnabled,
  type DingTalkNotificationCategory,
} from './settings';
import { completeDingTalkTodo, createDingTalkTodo } from './todo';
import { ensureDingTalkUserId, getDingTalkUnionId, listPublishNotifyUserIds } from './users';
import { sendActionCardNotify } from './work-notify';
import {
  enqueueNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
} from '@/platform/notifications/outbox';

function reviewTypeText(type: string): string {
  if (type in reviewTypeLabel) {
    return reviewTypeLabel[type as AiReviewType];
  }
  return type;
}

function resourceTypeText(type: unknown): string {
  if (typeof type === 'string' && type in resourceTypeLabel) {
    return resourceTypeLabel[type as AiResourceType];
  }
  return typeof type === 'string' && type ? type : '资源';
}

function extractProposed(proposedData: string): {
  name: string;
  type?: string;
  summary?: string;
  ownerName?: string;
  tags?: string;
} {
  try {
    const data = JSON.parse(proposedData) as Record<string, unknown>;
    const tags = Array.isArray(data.tags)
      ? data.tags.map(String).filter(Boolean).join('、')
      : typeof data.tags === 'string'
        ? data.tags
        : undefined;
    return {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '未命名资源',
      type: typeof data.type === 'string' ? data.type : undefined,
      summary: typeof data.summary === 'string' ? data.summary.trim() : undefined,
      ownerName: typeof data.ownerName === 'string' ? data.ownerName.trim() : undefined,
      tags,
    };
  } catch {
    return { name: '未命名资源' };
  }
}

function buildNotificationMarkdown(title: string, paragraphs: string[]) {
  return [
    `## ${title}`,
    '',
    ...paragraphs
      .filter((paragraph) => paragraph.trim())
      .flatMap((paragraph) => [paragraph, '']),
  ]
    .join('\n')
    .trim();
}

export async function scheduleReviewSubmitted(reviewId: string) {
  await enqueueNotificationEvent({
    eventType: NOTIFICATION_EVENT_TYPES.reviewSubmitted,
    idempotencyKey: `ai-resource.review-submitted:${reviewId}`,
    payload: { reviewId },
  });
}

export async function scheduleReviewResolved(reviewId: string, options?: { publish?: boolean }) {
  const publish = options?.publish !== false;
  await enqueueNotificationEvent({
    eventType: NOTIFICATION_EVENT_TYPES.reviewResolved,
    idempotencyKey: `ai-resource.review-resolved:${reviewId}:${publish ? 'publish' : 'no-publish'}`,
    payload: { reviewId, publish },
  });
}

/** 提交人废弃/重新提交后，完成驳回待办 */
export async function scheduleReworkHandled(
  reviewId: string,
  todo?: { dingtalkReworkTodoId: string | null; dingtalkReworkTodoUnionId: string | null },
) {
  const todoId = todo?.dingtalkReworkTodoId ?? '';
  await enqueueNotificationEvent({
    eventType: NOTIFICATION_EVENT_TYPES.reworkHandled,
    idempotencyKey: `ai-resource.rework-handled:${reviewId}:${todoId}`,
    payload: {
      reviewId,
      dingtalkReworkTodoId: todo?.dingtalkReworkTodoId ?? null,
      dingtalkReworkTodoUnionId: todo?.dingtalkReworkTodoUnionId ?? null,
    },
  });
}

async function completeReviewerTodo(review: {
  id: string;
  dingtalkTodoId: string | null;
  dingtalkTodoUnionId: string | null;
}) {
  if (!review.dingtalkTodoId || !review.dingtalkTodoUnionId) return;
  const completed = await completeDingTalkTodo(review.dingtalkTodoUnionId, review.dingtalkTodoId);
  if (!completed) throw new Error(`钉钉审批待办完成失败：${review.id}`);
  await db.aiResourceReviewRequest.update({
    where: { id: review.id },
    data: { dingtalkTodoId: null, dingtalkTodoUnionId: null },
  });
}

async function completeReworkTodo(review: {
  id: string;
  dingtalkReworkTodoId: string | null;
  dingtalkReworkTodoUnionId: string | null;
}) {
  if (!review.dingtalkReworkTodoId || !review.dingtalkReworkTodoUnionId) return;
  const completed = await completeDingTalkTodo(review.dingtalkReworkTodoUnionId, review.dingtalkReworkTodoId);
  if (!completed) throw new Error(`钉钉返工待办完成失败：${review.id}`);
  await db.aiResourceReviewRequest.update({
    where: { id: review.id },
    data: { dingtalkReworkTodoId: null, dingtalkReworkTodoUnionId: null },
  });
}

export async function onReworkHandled(
  reviewId: string,
  todo?: { dingtalkReworkTodoId: string | null; dingtalkReworkTodoUnionId: string | null },
): Promise<void> {
  if (todo) {
    await completeReworkTodo({
      id: reviewId,
      dingtalkReworkTodoId: todo.dingtalkReworkTodoId,
      dingtalkReworkTodoUnionId: todo.dingtalkReworkTodoUnionId,
    });
    return;
  }

  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      dingtalkReworkTodoId: true,
      dingtalkReworkTodoUnionId: true,
    },
  });
  if (review) await completeReworkTodo(review);
}

export async function onReviewSubmitted(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials) {
    console.warn('[dingtalk] skip review notify: missing DINGTALK_CLIENT_ID/SECRET');
    return;
  }
  if (!(await isDingTalkNotificationEnabled('reviewSubmitted'))) {
    console.log('[dingtalk] review submitted notification disabled');
    return;
  }

  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { username: true } },
      reviewer: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
  if (!review || review.status !== 'PENDING' || !review.reviewerId || !review.reviewer) {
    return;
  }

  const proposed = extractProposed(review.proposedData);
  const typeLabel = reviewTypeText(review.type);
  const subject = `【AI资源库】审批待处理｜${typeLabel}：${proposed.name}`;
  const notificationParagraphs = [
    `提交人：${review.requester.username}`,
    `说明：${review.updateSummary}`,
    '请尽快处理。',
  ];
  const description = notificationParagraphs.slice(0, 2).join('\n\n');
  const links = buildNotifyLinks(`/ai-resources/review/${review.id}`);

  const reviewerUnionId = await getDingTalkUnionId(review.reviewer.id);
  if (!reviewerUnionId) {
    console.warn('[dingtalk] skip review notify: reviewer has no DingTalk unionId', review.reviewerId);
    return;
  }

  if (env.hasAgentId) {
    const reviewerUserId = await ensureDingTalkUserId(review.reviewer.id);
    if (reviewerUserId && links) {
      const notifyResult = await sendActionCardNotify([reviewerUserId], {
        title: subject,
        markdown: buildNotificationMarkdown(subject, notificationParagraphs),
        singleTitle: '去处理',
        singleUrl: links.pcUrl,
      });
      if (notifyResult.sent === 0) throw new Error(`钉钉审批通知发送失败：${review.id}`);
    } else if (!reviewerUserId) {
      console.warn('[dingtalk] skip work notify: cannot resolve reviewer userid');
    } else if (!links) {
      console.warn('[dingtalk] skip work notify: APP_BASE_URL not set');
    }
  } else {
    console.warn('[dingtalk] skip work notify: DINGTALK_AGENT_ID not set');
  }

  if (!links) {
    console.warn('[dingtalk] skip todo: APP_BASE_URL not set');
    return;
  }

  const todo = await createDingTalkTodo({
    unionId: reviewerUnionId,
    subject,
    description,
    sourceId: `${review.id}-review`,
    detailPcUrl: links.pcUrl,
    detailAppUrl: links.appUrl,
    executorUnionIds: [reviewerUnionId],
    priority: 40,
  });

  if (!todo) throw new Error(`钉钉审批待办创建失败：${review.id}`);
  await db.aiResourceReviewRequest.update({
    where: { id: review.id },
    data: {
      dingtalkTodoId: todo.taskId,
      dingtalkTodoUnionId: todo.unionId,
    },
  });
}

async function createSubmitterReworkTodo(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAppBaseUrl) return;
  if (!(await isDingTalkNotificationEnabled('reviewRejected'))) {
    console.log('[dingtalk] review rejected notification disabled');
    return;
  }

  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { id: true, username: true } },
      reviewer: { select: { username: true } },
    },
  });
  if (!review || review.status !== 'REJECTED') return;

  const unionId = await getDingTalkUnionId(review.requester.id);
  if (!unionId) {
    console.warn('[dingtalk] skip rework todo: submitter has no unionId', review.requesterId);
    return;
  }

  const proposed = extractProposed(review.proposedData);
  const typeLabel = reviewTypeText(review.type);
  const notificationParagraphs = [
    `审批人：${review.reviewer?.username ?? '-'}`,
    review.rejectReason ? `驳回原因：${review.rejectReason}` : null,
    '请修改后重新提交，或废弃此单据。',
  ]
    .filter((line): line is string => Boolean(line));
  const subject = `【AI资源库】待处理｜${typeLabel}被驳回：${proposed.name}`;
  const description = notificationParagraphs.join('\n\n');
  const links = buildNotifyLinks(`/ai-resources/review/${review.id}`);
  if (!links) return;

  if (env.hasAgentId) {
    const userid = await ensureDingTalkUserId(review.requester.id);
    if (userid) {
      const notifyResult = await sendActionCardNotify([userid], {
        title: subject,
        markdown: buildNotificationMarkdown(subject, notificationParagraphs),
        singleTitle: '去处理',
        singleUrl: links.pcUrl,
      });
      if (notifyResult.sent === 0) throw new Error(`钉钉返工通知发送失败：${review.id}`);
    }
  }

  const todo = await createDingTalkTodo({
    unionId,
    subject,
    description,
    sourceId: `${review.id}-rework`,
    detailPcUrl: links.pcUrl,
    detailAppUrl: links.appUrl,
    executorUnionIds: [unionId],
    priority: 40,
  });

  if (!todo) throw new Error(`钉钉返工待办创建失败：${review.id}`);
  await db.aiResourceReviewRequest.update({
    where: { id: review.id },
    data: {
      dingtalkReworkTodoId: todo.taskId,
      dingtalkReworkTodoUnionId: todo.unionId,
    },
  });
}

async function notifySubmitterApproved(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAgentId) return;
  if (!(await isDingTalkNotificationEnabled('reviewApproved'))) {
    console.log('[dingtalk] review approved notification disabled');
    return;
  }

  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { id: true, username: true } },
      reviewer: { select: { username: true } },
      resource: { select: { id: true, name: true } },
    },
  });
  if (!review || review.status !== 'APPROVED') return;

  const userid = await ensureDingTalkUserId(review.requester.id);
  if (!userid) {
    console.warn('[dingtalk] skip submitter notify: no dingtalk userid', review.requesterId);
    return;
  }

  const proposed = extractProposed(review.proposedData);
  const title = review.resource?.name ?? proposed.name;
  const typeLabel = reviewTypeText(review.type);
  const subject = `【AI资源库】${typeLabel}已通过：${title}`;
  const links = buildNotifyLinks(`/ai-resources/review/${review.id}`);
  if (!links) return;

  const notifyResult = await sendActionCardNotify([userid], {
    title: subject,
    markdown: buildNotificationMarkdown(subject, [
      `审批人：${review.reviewer?.username ?? '-'}`,
      '可点击查看详情。',
    ]),
    singleTitle: '查看详情',
    singleUrl: links.pcUrl,
  });
  if (notifyResult.sent === 0) throw new Error(`钉钉审批结果通知发送失败：${review.id}`);
}

export async function onReviewResolved(
  reviewId: string,
  options?: { publish?: boolean },
): Promise<void> {
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      type: true,
      dingtalkTodoId: true,
      dingtalkTodoUnionId: true,
    },
  });
  if (!review) return;

  await completeReviewerTodo(review);

  if (review.status === 'REJECTED') {
    await createSubmitterReworkTodo(review.id);
  } else if (review.status === 'APPROVED') {
    await notifySubmitterApproved(review.id);
  }

  const shouldPublish =
    options?.publish !== false &&
    review.status === 'APPROVED' &&
    (review.type === 'CREATE' || review.type === 'UPDATE');

  if (shouldPublish) {
    const result = await onResourcePublishedNotify(review.id);
    console.log('[dingtalk] publish notify result:', result);
  }
}

function buildPublishCardMarkdown(input: {
  headline: string;
  name: string;
  typeLabel: string;
  summary?: string;
  ownerName?: string;
  tags?: string;
  requesterName: string;
  updateSummary?: string;
}) {
  const lines = [
    `## 【AI资源库】${input.headline}`,
    '',
    `### ${input.name}`,
    '',
    `**类型**  ${input.typeLabel}`,
  ];
  if (input.ownerName) lines.push('', `**负责人**  ${input.ownerName}`);
  if (input.tags) lines.push('', `**适用小组**  ${input.tags}`);
  lines.push('', `**提交人**  ${input.requesterName}`);
  if (input.summary) {
    lines.push('', '---', '', `**使用说明**`, '', input.summary.slice(0, 500));
  }
  if (input.updateSummary) {
    lines.push('', `**变更说明**  ${input.updateSummary.slice(0, 200)}`);
  }
  return lines.join('\n');
}

export type ResourceBroadcastInput = {
  kind: 'CREATE' | 'UPDATE';
  resourceId: string;
  name: string;
  summary?: string | null;
  type?: string | null;
  ownerName?: string | null;
  tags?: string | null;
  actorName: string;
  updateSummary?: string | null;
};

export async function scheduleResourceBroadcast(input: ResourceBroadcastInput) {
  const eventFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 24);
  await enqueueNotificationEvent({
    eventType: NOTIFICATION_EVENT_TYPES.resourceBroadcast,
    idempotencyKey: `ai-resource.resource-broadcast:${input.resourceId}:${eventFingerprint}`,
    payload: input,
  });
}

export async function notifyResourceBroadcast(input: ResourceBroadcastInput): Promise<{
  enabled: boolean;
  sent: number;
  reason?: string;
}> {
  if (!(await isDingTalkNotificationEnabled('publish'))) {
    return { enabled: false, sent: 0, reason: 'disabled' };
  }

  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAgentId || !env.hasAppBaseUrl) {
    console.warn('[dingtalk] skip publish notify: env incomplete', env);
    return { enabled: true, sent: 0, reason: 'env_incomplete' };
  }

  const links = buildNotifyLinks(`/ai-resources/${input.resourceId}`);
  if (!links) {
    return { enabled: true, sent: 0, reason: 'env_incomplete' };
  }

  const userIds = await listPublishNotifyUserIds();
  if (userIds.length === 0) {
    console.warn('[dingtalk] publish notify: no recipients with dingtalk userid');
    return { enabled: true, sent: 0, reason: 'no_recipients' };
  }

  const headline = input.kind === 'CREATE' ? '新资源已发布' : '资源已更新';
  const typeLabel = resourceTypeText(input.type);
  const tags = (input.tags || '').replace(/,/g, '、');
  const summary = (input.summary || '').trim();
  const cardTitle = `【AI资源库】${headline} · ${input.name}`;
  const markdown = buildPublishCardMarkdown({
    headline,
    name: input.name,
    typeLabel,
    summary: summary || undefined,
    ownerName: input.ownerName || undefined,
    tags: tags || undefined,
    requesterName: input.actorName,
    updateSummary: input.kind === 'UPDATE' ? input.updateSummary || undefined : undefined,
  });

  const result = await sendActionCardNotify(userIds, {
    title: cardTitle,
    markdown,
    singleTitle: '查看详情',
    singleUrl: links.pcUrl,
  });

  if (result.sent === 0) {
    throw new Error(`钉钉资源发布广播发送失败：${input.resourceId}`);
  }
  return { enabled: true, sent: result.sent };
}

export async function onResourcePublishedNotify(reviewId: string): Promise<{
  enabled: boolean;
  sent: number;
  reason?: string;
}> {
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          summary: true,
          type: true,
          ownerName: true,
          tags: true,
        },
      },
      requester: { select: { username: true } },
    },
  });
  if (!review || review.status !== 'APPROVED') {
    return { enabled: true, sent: 0, reason: 'not_approved' };
  }
  if (review.type !== 'CREATE' && review.type !== 'UPDATE') {
    return { enabled: true, sent: 0, reason: 'type_skipped' };
  }

  const resourceId = review.resourceId ?? review.resource?.id;
  if (!resourceId) {
    return { enabled: true, sent: 0, reason: 'missing_resource' };
  }

  const proposed = extractProposed(review.proposedData);
  return notifyResourceBroadcast({
    kind: review.type === 'CREATE' ? 'CREATE' : 'UPDATE',
    resourceId,
    name: review.resource?.name ?? proposed.name,
    summary: review.resource?.summary || proposed.summary,
    type: review.resource?.type ?? proposed.type,
    ownerName: review.resource?.ownerName || proposed.ownerName,
    tags: review.resource?.tags || proposed.tags,
    actorName: review.requester.username,
    updateSummary: review.type === 'UPDATE' ? review.updateSummary : undefined,
  });
}

const TEST_NOTIFICATION_CONTENT: Record<
  DingTalkNotificationCategory,
  { title: string; paragraphs: string[]; singleTitle: string }
> = {
  reviewSubmitted: {
    title: '【AI资源库】审批待处理通知测试',
    paragraphs: ['提交人：测试用户', '说明：这是一条待审批通知测试消息。', '请尽快处理。'],
    singleTitle: '去处理',
  },
  reviewRejected: {
    title: '【AI资源库】驳回待处理通知测试',
    paragraphs: ['审批人：测试审批人', '驳回原因：这是一条驳回通知测试消息。', '请修改后重新提交，或废弃此单据。'],
    singleTitle: '去处理',
  },
  reviewApproved: {
    title: '【AI资源库】审批通过通知测试',
    paragraphs: ['审批人：测试审批人', '这是一条审批通过通知测试消息。'],
    singleTitle: '查看详情',
  },
  publish: {
    title: '【AI资源库】资源发布通知测试',
    paragraphs: ['测试资源', '类型：应用', '这是一条资源发布/更新广播测试消息。'],
    singleTitle: '查看详情',
  },
};

export async function sendTestNotifyToUser(
  localUserId: string,
  category: DingTalkNotificationCategory = 'publish',
): Promise<{ ok: boolean; error?: string }> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAgentId || !env.hasAppBaseUrl) {
    return { ok: false, error: '请先配置 DINGTALK_CLIENT_ID/SECRET、DINGTALK_AGENT_ID、APP_BASE_URL' };
  }

  const userid = await ensureDingTalkUserId(localUserId);
  if (!userid) {
    return { ok: false, error: '当前账号未绑定钉钉企业 userid，请先通过 Authing 登录或刷新钉钉身份' };
  }

  const url = buildAuthEntryUrl('/ai-resources/admin/dingtalk');
  if (!url) {
    return { ok: false, error: 'APP_BASE_URL 未配置' };
  }

  const content = TEST_NOTIFICATION_CONTENT[category];
  const result = await sendActionCardNotify([userid], {
    title: content.title,
    markdown: buildNotificationMarkdown(content.title, content.paragraphs),
    singleTitle: content.singleTitle,
    singleUrl: buildDingTalkPcBrowserUrl(url),
  });

  if (result.sent === 0) {
    return { ok: false, error: '钉钉接口发送失败，请查看服务端日志' };
  }
  return { ok: true };
}

/** 测试待办：给当前用户创建一条与正式待办格式一致的待办（直连钉钉） */
export async function sendTestTodoToUser(
  localUserId: string,
  category: DingTalkNotificationCategory = 'publish',
): Promise<{ ok: boolean; error?: string; taskId?: string }> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAppBaseUrl) {
    return { ok: false, error: '请先配置 DINGTALK_CLIENT_ID/SECRET、APP_BASE_URL' };
  }

  const unionId = await getDingTalkUnionId(localUserId);
  if (!unionId) {
    return { ok: false, error: '当前账号未绑定钉钉 unionId，请先通过 Authing 登录或刷新钉钉身份' };
  }

  const content = TEST_NOTIFICATION_CONTENT[category];
  const url = buildAuthEntryUrl('/ai-resources/admin/dingtalk');
  if (!url) {
    return { ok: false, error: 'APP_BASE_URL 未配置' };
  }

  const subject = `【AI资源库】测试待办｜${content.title.replace('【AI资源库】', '')}\n${content.paragraphs.join('\n')}\n\n【测试】`;
  const todo = await createDingTalkTodo({
    unionId,
    subject,
    description: content.paragraphs.join('\n\n'),
    sourceId: `test-todo-${Date.now()}`,
    detailPcUrl: buildDingTalkPcBrowserUrl(url),
    detailAppUrl: url,
    executorUnionIds: [unionId],
    priority: 40,
  });

  if (!todo) {
    return { ok: false, error: '钉钉待办创建失败，请查看服务端日志' };
  }
  return { ok: true, taskId: todo.taskId };
}

/** 完成测试待办：把指定 taskId 的待办标记为完成（直连钉钉） */
export async function completeTestTodo(
  taskId: string,
  localUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const unionId = await getDingTalkUnionId(localUserId);
  if (!unionId) {
    return { ok: false, error: '当前账号未绑定钉钉 unionId，请先通过 Authing 登录或刷新钉钉身份' };
  }

  const ok = await completeDingTalkTodo(unionId, taskId);
  if (!ok) {
    return { ok: false, error: '钉钉待办完成失败，请查看服务端日志' };
  }
  return { ok: true };
}
