import { db } from '@/lib/database';
import {
  isExternalNotificationEnabled,
  type ExternalNotificationCategory,
} from '@/lib/external-notifications/settings';
import {
  asRecord,
  createDwsCli,
  stringValue,
  type DwsCli,
} from './cli';

export class DwsNotificationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable?: boolean } = {}) {
    super(message);
    this.name = 'DwsNotificationError';
    this.retryable = options.retryable ?? true;
  }
}

function appLink(path: string) {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) {
    throw new DwsNotificationError('APP_BASE_URL 未配置，无法生成通知详情链接', {
      retryable: false,
    });
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const entry = `/api/auth/entry?next=${encodeURIComponent(normalizedPath)}`;
  return `${base}${entry}`;
}

function proposedData(raw: string) {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : '未命名资源',
      type: typeof value.type === 'string' ? value.type : '资源',
      summary: typeof value.summary === 'string' ? value.summary.trim() : '',
      ownerName: typeof value.ownerName === 'string' ? value.ownerName.trim() : '',
      tags: Array.isArray(value.tags) ? value.tags.map(String).join('、') : String(value.tags ?? ''),
    };
  } catch {
    return { name: '未命名资源', type: '资源', summary: '', ownerName: '', tags: '' };
  }
}

function taskIdFromResponse(value: unknown) {
  const record = asRecord(value);
  return stringValue(record.taskId)
    ?? stringValue(record.task_id)
    ?? stringValue(record.id)
    ?? stringValue(asRecord(record.task).taskId)
    ?? stringValue(asRecord(record.task).id);
}

async function dwsUserId(localUserId: string) {
  const rows = await db.$queryRaw<{ directory_user_id: string | null }[]>`
    SELECT directory_user_id
    FROM users
    WHERE id = ${localUserId}
    LIMIT 1
  `;
  return rows[0]?.directory_user_id ?? null;
}

async function createTodo(
  cli: DwsCli,
  input: { title: string; description: string; executorId: string; priority?: number },
) {
  // CLI v1.x 的 todo task create 不支持 --description，附加信息并入标题
  const title = input.description ? `${input.title}\n${input.description}` : input.title;
  const response = await cli.run<unknown>([
    'todo',
    'task',
    'create',
    '--title',
    title,
    '--executors',
    input.executorId,
    '--priority',
    String(input.priority ?? 40),
  ]);
  const taskId = taskIdFromResponse(response);
  if (!taskId) {
    throw new DwsNotificationError('DWS Todo 创建响应缺少 taskId', { retryable: false });
  }
  return taskId;
}

async function completeTodo(cli: DwsCli, taskId: string) {
  await cli.run([
    'todo',
    'task',
    'done',
    '--task-id',
    taskId,
    '--status',
    'true',
  ]);
}

async function sendChat(
  cli: DwsCli,
  input: { userId: string; text: string; uuid: string },
) {
  await cli.run([
    'chat',
    'message',
    'send',
    '--user',
    input.userId,
    '--text',
    input.text,
    '--uuid',
    input.uuid,
  ]);
}

async function notificationEnabled(category: ExternalNotificationCategory) {
  return isExternalNotificationEnabled(category);
}

export async function processReviewSubmitted(
  reviewId: string,
  jobId: string,
  cli: DwsCli = createDwsCli(),
) {
  void jobId;
  if (!(await notificationEnabled('reviewSubmitted'))) return { skipped: true };
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { username: true } },
      reviewer: { select: { id: true, username: true } },
    },
  });
  if (!review || review.status !== 'PENDING' || !review.reviewer) return { skipped: true };
  if (review.externalTodoProvider === 'dws' && review.externalTodoId) {
    return {
      taskId: review.externalTodoId,
      executorId: review.externalTodoAssigneeId,
      deduplicated: true,
    };
  }

  const executorId = await dwsUserId(review.reviewer.id);
  if (!executorId) {
    throw new DwsNotificationError('审批人未匹配到 DWS userId，请先同步组织目录', {
      retryable: false,
    });
  }
  const proposed = proposedData(review.proposedData);
  const title = `【AI资源库】审批待处理｜${review.type}：${proposed.name}`;
  const link = appLink(`/ai-resources/review/${review.id}`);
  const description = `提交人：${review.requester.username}\n\n说明：${review.updateSummary}`;
  const taskId = await createTodo(cli, {
    title,
    description: `${description}\n\n详情：${link}`,
    executorId,
  });

  await db.$queryRaw`
    UPDATE ai_resource_review_requests
    SET external_todo_provider = 'dws',
        external_todo_id = ${taskId},
        external_todo_assignee_id = ${executorId}
    WHERE id = ${review.id}
  `;
  return { taskId, executorId };
}

async function completeReviewerTodoForReview(
  review: { id: string; externalTodoProvider: string | null; externalTodoId: string | null },
  cli: DwsCli,
) {
  if (review.externalTodoProvider !== 'dws' || !review.externalTodoId) return { completed: false };
  await completeTodo(cli, review.externalTodoId);
  await db.$queryRaw`
    UPDATE ai_resource_review_requests
    SET external_todo_provider = NULL,
        external_todo_id = NULL,
        external_todo_assignee_id = NULL
    WHERE id = ${review.id}
  `;
  return { completed: true };
}

async function createReworkTodo(
  reviewId: string,
  jobId: string,
  cli: DwsCli,
) {
  void jobId;
  if (!(await notificationEnabled('reviewRejected'))) return { skipped: true };
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { id: true, username: true } },
      reviewer: { select: { username: true } },
    },
  });
  if (!review || review.status !== 'REJECTED') return { skipped: true };
  if (review.externalReworkTodoProvider === 'dws' && review.externalReworkTodoId) {
    return {
      taskId: review.externalReworkTodoId,
      executorId: review.externalReworkTodoAssigneeId,
      deduplicated: true,
    };
  }

  const executorId = await dwsUserId(review.requester.id);
  if (!executorId) {
    throw new DwsNotificationError('申请人未匹配到 DWS userId，请先同步组织目录', {
      retryable: false,
    });
  }
  const proposed = proposedData(review.proposedData);
  const title = `【AI资源库】待处理｜${review.type}被驳回：${proposed.name}`;
  const reason = review.rejectReason ? `\n\n驳回原因：${review.rejectReason}` : '';
  const link = appLink(`/ai-resources/review/${review.id}`);
  const taskId = await createTodo(cli, {
    title,
    description: `审批人：${review.reviewer?.username ?? '-'}${reason}\n\n详情：${link}`,
    executorId,
  });
  await db.$queryRaw`
    UPDATE ai_resource_review_requests
    SET external_rework_todo_provider = 'dws',
        external_rework_todo_id = ${taskId},
        external_rework_todo_assignee_id = ${executorId}
    WHERE id = ${review.id}
  `;
  return { taskId, executorId };
}

async function notifyApproved(
  reviewId: string,
  jobId: string,
  cli: DwsCli,
) {
  if (!(await notificationEnabled('reviewApproved'))) return { skipped: true };
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      requester: { select: { id: true, username: true } },
      reviewer: { select: { username: true } },
      resource: { select: { name: true } },
    },
  });
  if (!review || review.status !== 'APPROVED') return { skipped: true };

  const recipientId = await dwsUserId(review.requester.id);
  if (!recipientId) {
    throw new DwsNotificationError('申请人未匹配到 DWS userId，请先同步组织目录', {
      retryable: false,
    });
  }
  const proposed = proposedData(review.proposedData);
  const title = `【AI资源库】${review.type}已通过：${review.resource?.name ?? proposed.name}`;
  const text = `## ${title}\n\n审批人：${review.reviewer?.username ?? '-'}\n\n[查看详情](${appLink(`/ai-resources/review/${review.id}`)})`;
  await sendChat(cli, {
    userId: recipientId,
    text,
    uuid: `${jobId}:approved:${recipientId}`,
  });
  return { sent: 1, recipientId };
}

export type ResourceBroadcastPayload = {
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

export async function processResourceBroadcast(
  input: ResourceBroadcastPayload,
  jobId: string,
  cli: DwsCli = createDwsCli(),
) {
  if (!(await notificationEnabled('publish'))) return { skipped: true, sent: 0 };
  const recipients = await db.$queryRaw<{ id: string; directory_user_id: string }[]>`
    SELECT id, directory_user_id
    FROM users
    WHERE status = 'active'
      AND directory_user_id IS NOT NULL
    ORDER BY id
  `;
  if (!recipients.length) return { skipped: true, sent: 0, reason: 'no_recipients' };

  const headline = input.kind === 'CREATE' ? '新资源已发布' : '资源已更新';
  const text = [
    `## 【AI资源库】${headline} · ${input.name}`,
    '',
    `类型：${input.type ?? '资源'}`,
    input.ownerName ? `负责人：${input.ownerName}` : '',
    input.tags ? `适用小组：${input.tags}` : '',
    `提交人：${input.actorName}`,
    input.summary ? `\n使用说明：${input.summary.slice(0, 500)}` : '',
    input.updateSummary ? `\n变更说明：${input.updateSummary.slice(0, 200)}` : '',
    `\n[查看详情](${appLink(`/ai-resources/${input.resourceId}`)})`,
  ].filter(Boolean).join('\n');

  let sent = 0;
  for (const recipient of recipients) {
    await sendChat(cli, {
      userId: recipient.directory_user_id,
      text,
      uuid: `${jobId}:publish:${recipient.directory_user_id}`,
    });
    sent += 1;
  }
  return { sent, recipientCount: recipients.length };
}

export async function processReworkHandled(
  reviewId: string,
  cli: DwsCli = createDwsCli(),
) {
  const rows = await db.$queryRaw<{
    id: string;
    external_rework_todo_provider: string | null;
    external_rework_todo_id: string | null;
  }[]>`
    SELECT id, external_rework_todo_provider, external_rework_todo_id
    FROM ai_resource_review_requests
    WHERE id = ${reviewId}
    LIMIT 1
  `;
  const review = rows[0];
  if (!review || review.external_rework_todo_provider !== 'dws' || !review.external_rework_todo_id) {
    return { completed: false };
  }
  await completeTodo(cli, review.external_rework_todo_id);
  await db.$queryRaw`
    UPDATE ai_resource_review_requests
    SET external_rework_todo_provider = NULL,
        external_rework_todo_id = NULL,
        external_rework_todo_assignee_id = NULL
    WHERE id = ${review.id}
  `;
  return { completed: true };
}

export async function processReviewResolved(
  reviewId: string,
  publish: boolean,
  jobId: string,
  cli: DwsCli = createDwsCli(),
) {
  const review = await db.aiResourceReviewRequest.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      externalTodoProvider: true,
      externalTodoId: true,
    },
  });
  if (!review) return { skipped: true };

  const completed = await completeReviewerTodoForReview(review, cli);
  if (review.status === 'REJECTED') {
    return { completed: completed.completed, rework: await createReworkTodo(reviewId, jobId, cli) };
  }
  if (review.status === 'APPROVED') {
    return {
      completed: completed.completed,
      approved: await notifyApproved(reviewId, jobId, cli),
      publish: publish ? 'queued-by-follow-up' : 'disabled',
    };
  }
  return { completed: completed.completed, skipped: true };
}

export async function processTestNotification(
  input: { localUserId: string; category: ExternalNotificationCategory; path: string },
  jobId: string,
  cli: DwsCli = createDwsCli(),
) {
  const recipientId = await dwsUserId(input.localUserId);
  if (!recipientId) {
    throw new DwsNotificationError('当前管理员未匹配到 DWS userId，请先同步组织目录', {
      retryable: false,
    });
  }
  const title = `【AI资源库】外部通知测试：${input.category}`;
  await sendChat(cli, {
    userId: recipientId,
    text: `## ${title}\n\n这是 DWS Worker 测试消息。\n\n[打开管理页面](${appLink(input.path)})`,
    uuid: `${jobId}:test:${recipientId}`,
  });
  return { sent: 1, recipientId };
}
