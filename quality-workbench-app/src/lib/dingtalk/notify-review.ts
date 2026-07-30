import { prisma } from '@/lib/prisma';
import { resourceTypeLabel, reviewTypeLabel } from '@/modules/ai-resources/labels';
import type { AiResourceType, AiReviewType } from '@/modules/ai-resources/constants';
import { buildAuthEntryUrl, buildDingTalkPcBrowserUrl, buildNotifyLinks, dingtalkNotifyEnvStatus } from './config';
import { isPublishNotifyEnabled } from './settings';
import { completeDingTalkTodo, createDingTalkTodo } from './todo';
import { ensureDingTalkUserId, getDingTalkUnionId, listPublishNotifyUserIds } from './users';
import { sendActionCardNotify } from './work-notify';

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

function fireAndForget(label: string, work: () => Promise<void>) {
  void work().catch((error) => {
    console.error(`[dingtalk] ${label} failed:`, error);
  });
}

export function scheduleReviewSubmitted(reviewId: string) {
  fireAndForget('onReviewSubmitted', () => onReviewSubmitted(reviewId));
}

export function scheduleReviewResolved(reviewId: string, options?: { publish?: boolean }) {
  fireAndForget('onReviewResolved', () => onReviewResolved(reviewId, options));
}

/** 提交人废弃/重新提交后，完成驳回待办 */
export function scheduleReworkHandled(reviewId: string) {
  fireAndForget('onReworkHandled', () => onReworkHandled(reviewId));
}

async function completeReviewerTodo(review: {
  id: string;
  dingtalkTodoId: string | null;
  dingtalkTodoUnionId: string | null;
}) {
  if (!review.dingtalkTodoId || !review.dingtalkTodoUnionId) return;
  await completeDingTalkTodo(review.dingtalkTodoUnionId, review.dingtalkTodoId);
  await prisma.aiResourceReviewRequest.update({
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
  await completeDingTalkTodo(review.dingtalkReworkTodoUnionId, review.dingtalkReworkTodoId);
  await prisma.aiResourceReviewRequest.update({
    where: { id: review.id },
    data: { dingtalkReworkTodoId: null, dingtalkReworkTodoUnionId: null },
  });
}

export async function onReworkHandled(reviewId: string): Promise<void> {
  const review = await prisma.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      dingtalkReworkTodoId: true,
      dingtalkReworkTodoUnionId: true,
    },
  });
  if (!review) return;
  await completeReworkTodo(review);
}

export async function onReviewSubmitted(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials) {
    console.warn('[dingtalk] skip review notify: missing DINGTALK_CLIENT_ID/SECRET');
    return;
  }

  const review = await prisma.aiResourceReviewRequest.findUnique({
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
  const subject = `【AI资源审批】${typeLabel}：${proposed.name}`;
  const description = `提交人：${review.requester.username}\n说明：${review.updateSummary}`;
  const links = buildNotifyLinks(`/ai-resources/review/${review.id}`);

  const reviewerUnionId = await getDingTalkUnionId(review.reviewer.id);
  if (!reviewerUnionId) {
    console.warn('[dingtalk] skip review notify: reviewer has no DingTalk unionId', review.reviewerId);
    return;
  }

  if (env.hasAgentId) {
    const reviewerUserId = await ensureDingTalkUserId(review.reviewer.id);
    if (reviewerUserId && links) {
      await sendActionCardNotify([reviewerUserId], {
        title: subject,
        markdown: `### ${subject}\n\n${description}\n\n请尽快处理。`,
        singleTitle: '去处理',
        singleUrl: links.pcUrl,
      });
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
    sourceId: `${review.id}-review-${Date.now()}`,
    detailPcUrl: links.pcUrl,
    detailAppUrl: links.appUrl,
    executorUnionIds: [reviewerUnionId],
    priority: 40,
  });

  if (todo) {
    await prisma.aiResourceReviewRequest.update({
      where: { id: review.id },
      data: {
        dingtalkTodoId: todo.taskId,
        dingtalkTodoUnionId: todo.unionId,
      },
    });
  }
}

async function createSubmitterReworkTodo(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAppBaseUrl) return;

  const review = await prisma.aiResourceReviewRequest.findUnique({
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
  const subject = `【AI资源待处理】${typeLabel}被驳回：${proposed.name}`;
  const description = [
    `审批人：${review.reviewer?.username ?? '-'}`,
    review.rejectReason ? `驳回原因：${review.rejectReason}` : null,
    '请修改后重新提交，或废弃此单据。',
  ]
    .filter(Boolean)
    .join('\n');
  const links = buildNotifyLinks(`/ai-resources/review/${review.id}`);
  if (!links) return;

  if (env.hasAgentId) {
    const userid = await ensureDingTalkUserId(review.requester.id);
    if (userid) {
      await sendActionCardNotify([userid], {
        title: subject,
        markdown: `### ${subject}\n\n${description}`,
        singleTitle: '去处理',
        singleUrl: links.pcUrl,
      });
    }
  }

  const todo = await createDingTalkTodo({
    unionId,
    subject,
    description,
    sourceId: `${review.id}-rework-${Date.now()}`,
    detailPcUrl: links.pcUrl,
    detailAppUrl: links.appUrl,
    executorUnionIds: [unionId],
    priority: 40,
  });

  if (todo) {
    await prisma.aiResourceReviewRequest.update({
      where: { id: review.id },
      data: {
        dingtalkReworkTodoId: todo.taskId,
        dingtalkReworkTodoUnionId: todo.unionId,
      },
    });
  }
}

async function notifySubmitterApproved(reviewId: string): Promise<void> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAgentId) return;

  const review = await prisma.aiResourceReviewRequest.findUnique({
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

  await sendActionCardNotify([userid], {
    title: subject,
    markdown: `### ${subject}\n\n审批人：${review.reviewer?.username ?? '-'}\n\n可点击查看详情。`,
    singleTitle: '查看详情',
    singleUrl: links.pcUrl,
  });
}

export async function onReviewResolved(
  reviewId: string,
  options?: { publish?: boolean },
): Promise<void> {
  const review = await prisma.aiResourceReviewRequest.findUnique({
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
    `## ${input.headline}`,
    '',
    `### ${input.name}`,
    '',
    `**类型**  ${input.typeLabel}`,
  ];
  if (input.ownerName) lines.push(`**负责人**  ${input.ownerName}`);
  if (input.tags) lines.push(`**适用小组**  ${input.tags}`);
  lines.push(`**提交人**  ${input.requesterName}`);
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

export function scheduleResourceBroadcast(input: ResourceBroadcastInput) {
  fireAndForget('resourceBroadcast', async () => {
    const result = await notifyResourceBroadcast(input);
    console.log('[dingtalk] resource broadcast result:', result);
  });
}

export async function notifyResourceBroadcast(input: ResourceBroadcastInput): Promise<{
  enabled: boolean;
  sent: number;
  reason?: string;
}> {
  if (!(await isPublishNotifyEnabled())) {
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

  return { enabled: true, sent: result.sent };
}

export async function onResourcePublishedNotify(reviewId: string): Promise<{
  enabled: boolean;
  sent: number;
  reason?: string;
}> {
  const review = await prisma.aiResourceReviewRequest.findUnique({
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

export async function sendTestNotifyToUser(localUserId: string): Promise<{ ok: boolean; error?: string }> {
  const env = dingtalkNotifyEnvStatus();
  if (!env.hasCredentials || !env.hasAgentId || !env.hasAppBaseUrl) {
    return { ok: false, error: '请先配置 DINGTALK_CLIENT_ID/SECRET、DINGTALK_AGENT_ID、APP_BASE_URL' };
  }

  const userid = await ensureDingTalkUserId(localUserId);
  if (!userid) {
    return { ok: false, error: '当前账号未绑定钉钉企业 userid，请先用钉钉扫码登录一次' };
  }

  const url = buildAuthEntryUrl('/ai-resources/admin/dingtalk');
  if (!url) {
    return { ok: false, error: 'APP_BASE_URL 未配置' };
  }

  const result = await sendActionCardNotify([userid], {
    title: '【AI资源库】钉钉通知测试',
    markdown: [
      '## 钉钉工作通知测试',
      '',
      '### 配置正常',
      '',
      '若你收到本条消息，说明应用工作通知配置正常。',
      '',
      '**通道**  企业内部应用工作通知',
    ].join('\n'),
    singleTitle: '打开配置',
    singleUrl: buildDingTalkPcBrowserUrl(url),
  });

  if (result.sent === 0) {
    return { ok: false, error: '钉钉接口发送失败，请查看服务端日志' };
  }
  return { ok: true };
}
