import { prisma } from '@/lib/prisma';
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

/** Resolve corp userid for a local user; persist when found. */
export async function ensureDingTalkUserId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dingtalkUserId: true,
      externalSource: true,
      externalId: true,
    },
  });
  if (!user) return null;
  if (user.dingtalkUserId) return user.dingtalkUserId;
  if (user.externalSource !== 'dingtalk' || !user.externalId) return null;

  const userid = await resolveUserIdByUnionId(user.externalId);
  if (!userid) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { dingtalkUserId: userid },
  });
  return userid;
}

export async function getDingTalkUnionId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalSource: true, externalId: true },
  });
  if (!user || user.externalSource !== 'dingtalk' || !user.externalId) return null;
  return user.externalId;
}

/** Active AI-resource members who have a DingTalk corp userid (or resolvable unionId). */
export async function listPublishNotifyUserIds(): Promise<string[]> {
  const members = await prisma.aiResourceMembership.findMany({
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
