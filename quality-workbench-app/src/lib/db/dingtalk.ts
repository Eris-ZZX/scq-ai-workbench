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
  /** 钉钉通讯录职位（title） */
  title?: string;
}

/** 按钉钉 unionId 查找已有的钉钉用户 */
export async function findDingTalkUser(unionId: string) {
  return prisma.user.findFirst({
    where: { externalSource: 'dingtalk', externalId: unionId },
  });
}

/** 根据钉钉 title 确保存在对应岗位，返回岗位 ID */
export async function ensurePositionRole(title: string): Promise<string | null> {
  if (!title.trim()) return null;
  const t = title.trim();

  const existing = await prisma.positionRole.findFirst({
    where: { name: t, isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const count = await prisma.positionRole.count();
  const created = await prisma.positionRole.create({
    data: { name: t, sortOrder: count + 100 },
    select: { id: true },
  });
  return created.id;
}

/** 为用户绑定岗位 */
export async function bindUserPosition(userId: string, positionRoleId: string) {
  await prisma.userPosition.upsert({
    where: { userId },
    create: { userId, positionRoleId },
    update: { positionRoleId },
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
      const suffix = crypto.randomBytes(3).toString('hex');
      return tryCreate(`${baseUsername}_${suffix}`);
    }
    throw err;
  }
}

/** 同步钉钉用户档案（昵称/头像/邮箱/岗位变更时更新） */
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
