// lib/db/dingtalk.ts — 钉钉用户数据库操作
import { prisma } from '@/lib/prisma';
import { DUMMY_HASH } from './auth';
import crypto from 'crypto';

export interface DingTalkProfile {
  /** 组织内跨应用唯一标识（隐藏，不作为用户名） */
  unionId: string;
  /** 钉钉昵称 → 作为平台用户名 */
  nick: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 邮箱 */
  email?: string;
}

/** 按钉钉 unionId 查找已有的钉钉用户 */
export async function findDingTalkUser(unionId: string) {
  return prisma.user.findFirst({
    where: { externalSource: 'dingtalk', externalId: unionId },
  });
}

/** 为钉钉扫码用户自动创建本地账号 */
export async function createDingTalkUser(profile: DingTalkProfile) {
  const baseUsername = profile.nick || `dt_${profile.unionId.slice(0, 8)}`;

  const tryCreate = async (username: string) => {
    return prisma.user.create({
      data: {
        username,
        passwordHash: DUMMY_HASH,
        email: profile.email ?? null,
        avatar: profile.avatarUrl ?? null,
        externalSource: 'dingtalk',
        externalId: profile.unionId,
        syncAt: new Date(),
        role: 'user',
        status: 'active',
      },
    });
  };

  try {
    return await tryCreate(baseUsername);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      // 用户名冲突，追加短后缀重试
      const suffix = crypto.randomBytes(3).toString('hex');
      return tryCreate(`${baseUsername}_${suffix}`);
    }
    throw err;
  }
}

/** 同步钉钉用户档案（昵称/头像/邮箱变更时更新，不改变用户名） */
export async function syncDingTalkUser(userId: string, profile: DingTalkProfile) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: profile.email ?? undefined,
      avatar: profile.avatarUrl ?? undefined,
      syncAt: new Date(),
    },
  });
}
