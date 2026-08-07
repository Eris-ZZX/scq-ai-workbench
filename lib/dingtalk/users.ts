import { db } from '@/lib/database';
import { getCorpAccessToken } from './token';

export async function resolveUserIdByUnionId(unionId: string): Promise<string | null> {
  const token = await getCorpAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unionid: unionId }),
    },
  );
  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    result?: { userid?: string };
  };
  if (!res.ok || data.errcode !== 0 || !data.result?.userid) {
    console.error('[dingtalk] getbyunionid failed:', data);
    return null;
  }
  return data.result.userid;
}

/** 取用户的钉钉 unionId：优先读 users.unionid 列（Authing 来源兼容），旧 dingtalk 来源读 external_id */
async function readDingTalkUnionId(user: {
  unionid: string | null;
  externalSource: string | null;
  externalId: string | null;
}): Promise<string | null> {
  if (user.unionid) return user.unionid;
  if (user.externalSource === 'dingtalk' && user.externalId) return user.externalId;
  return null;
}

/** Resolve corp userid for a local user; persist when found. */
export async function ensureDingTalkUserId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dingtalkUserId: true,
      unionid: true,
      externalSource: true,
      externalId: true,
    },
  });
  if (!user) return null;
  if (user.dingtalkUserId) return user.dingtalkUserId;

  const unionId = await readDingTalkUnionId(user);
  if (!unionId) return null;

  const userid = await resolveUserIdByUnionId(unionId);
  if (!userid) return null;

  await db.user.update({
    where: { id: user.id },
    data: { dingtalkUserId: userid },
  });
  return userid;
}

export async function getDingTalkUnionId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { unionid: true, externalSource: true, externalId: true },
  });
  if (!user) return null;
  return readDingTalkUnionId(user);
}

/** Active AI-resource members who have a DingTalk corp userid (or resolvable unionId). */
export async function listPublishNotifyUserIds(): Promise<string[]> {
  const members = await db.aiResourceMembership.findMany({
    where: { user: { status: 'active' } },
    select: {
      user: {
        select: {
          id: true,
          dingtalkUserId: true,
          externalSource: true,
          externalId: true,
        },
      },
    },
  });

  const userIds: string[] = [];
  for (const row of members) {
    const u = row.user;
    if (u.dingtalkUserId) {
      userIds.push(u.dingtalkUserId);
      continue;
    }
    if (u.externalSource === 'dingtalk' && u.externalId) {
      const resolved = await ensureDingTalkUserId(u.id);
      if (resolved) userIds.push(resolved);
    }
  }
  return [...new Set(userIds)];
}
