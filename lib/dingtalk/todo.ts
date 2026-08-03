import { getCorpAccessToken } from './token';

export type CreateTodoInput = {
  /** Path / operator unionId (usually the executor). */
  unionId: string;
  subject: string;
  description?: string;
  sourceId: string;
  detailPcUrl: string;
  detailAppUrl: string;
  executorUnionIds: string[];
  /** 10 lower / 20 normal / 30 high / 40 urgent */
  priority?: 10 | 20 | 30 | 40;
};

export type CreateTodoResult = {
  taskId: string;
  unionId: string;
};

export async function createDingTalkTodo(input: CreateTodoInput): Promise<CreateTodoResult | null> {
  const token = await getCorpAccessToken();
  if (!token) return null;

  const url = `https://api.dingtalk.com/v1.0/todo/users/${encodeURIComponent(input.unionId)}/tasks`;
  const body = {
    subject: input.subject.slice(0, 1024),
    description: input.description?.slice(0, 4096),
    sourceId: input.sourceId,
    creatorId: input.unionId,
    executorIds: input.executorUnionIds,
    priority: input.priority ?? 40,
    detailUrl: {
      pcUrl: input.detailPcUrl,
      appUrl: input.detailAppUrl,
    },
    notifyConfigs: {
      dingNotify: '1',
    },
    isOnlyShowExecutor: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-dingtalk-access-token': token,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: { id?: string; result?: { id?: string }; message?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    console.error('[dingtalk] create todo non-json:', text.slice(0, 300));
    return null;
  }

  const taskId = data.id ?? data.result?.id;
  if (!res.ok || !taskId) {
    console.error('[dingtalk] create todo failed:', res.status, text.slice(0, 500));
    return null;
  }

  return { taskId, unionId: input.unionId };
}

export async function completeDingTalkTodo(unionId: string, taskId: string): Promise<boolean> {
  const token = await getCorpAccessToken();
  if (!token) return false;

  const url = `https://api.dingtalk.com/v1.0/todo/users/${encodeURIComponent(unionId)}/tasks/${encodeURIComponent(taskId)}?operatorId=${encodeURIComponent(unionId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-dingtalk-access-token': token,
    },
    body: JSON.stringify({ done: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[dingtalk] complete todo failed:', res.status, text.slice(0, 500));
    return false;
  }
  return true;
}
