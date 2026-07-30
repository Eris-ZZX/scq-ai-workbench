import { getDingTalkAgentId } from './config';
import { getCorpAccessToken } from './token';

const BATCH_SIZE = 100;

export type ActionCardMessage = {
  title: string;
  markdown: string;
  singleTitle: string;
  singleUrl: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function asyncSend(params: {
  useridList: string[];
  msg: Record<string, unknown>;
}): Promise<boolean> {
  const agentId = getDingTalkAgentId();
  const token = await getCorpAccessToken();
  if (!agentId || !token || params.useridList.length === 0) return false;

  const res = await fetch(
    `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        userid_list: params.useridList.join(','),
        msg: params.msg,
      }),
    },
  );
  const data = (await res.json()) as { errcode?: number; errmsg?: string; task_id?: number };
  if (!res.ok || data.errcode !== 0) {
    console.error('[dingtalk] work notify failed:', data);
    return false;
  }
  return true;
}

export async function sendActionCardNotify(
  useridList: string[],
  card: ActionCardMessage,
): Promise<{ sent: number; batches: number }> {
  const unique = [...new Set(useridList.filter(Boolean))];
  if (unique.length === 0) return { sent: 0, batches: 0 };

  const msg = {
    msgtype: 'action_card',
    action_card: {
      title: card.title.slice(0, 64),
      markdown: card.markdown.slice(0, 2000),
      single_title: card.singleTitle.slice(0, 20),
      single_url: card.singleUrl,
    },
  };

  let sent = 0;
  let batches = 0;
  for (const batch of chunk(unique, BATCH_SIZE)) {
    batches += 1;
    const ok = await asyncSend({ useridList: batch, msg });
    if (ok) sent += batch.length;
  }
  return { sent, batches };
}

export async function sendMarkdownNotify(
  useridList: string[],
  title: string,
  text: string,
): Promise<{ sent: number; batches: number }> {
  const unique = [...new Set(useridList.filter(Boolean))];
  if (unique.length === 0) return { sent: 0, batches: 0 };

  const msg = {
    msgtype: 'markdown',
    markdown: {
      title: title.slice(0, 64),
      text: text.slice(0, 2000),
    },
  };

  let sent = 0;
  let batches = 0;
  for (const batch of chunk(unique, BATCH_SIZE)) {
    batches += 1;
    const ok = await asyncSend({ useridList: batch, msg });
    if (ok) sent += batch.length;
  }
  return { sent, batches };
}
