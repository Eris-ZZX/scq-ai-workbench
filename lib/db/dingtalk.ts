// lib/db/dingtalk.ts — 钉钉用户数据库操作
import { db, isUniqueViolation } from '@/lib/database';
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
  /** 企业通讯录 userid */
  dingtalkUserId?: string;
  /** 直属上级企业通讯录 userid */
  supervisorDingtalkUserId?: string;
  /** 直属上级姓名 */
  supervisorName?: string;
}

/** 按钉钉 unionId 查找已有的钉钉用户（组合唯一约束） */
export async function findDingTalkUser(unionId: string) {
  return db.user.findUnique({
    where: {
      externalSource_externalId: {
        externalSource: 'dingtalk',
        externalId: unionId,
      },
    },
  });
}

/** 根据钉钉 title 确保存在对应岗位，返回岗位 ID */
export async function ensurePositionRole(title: string): Promise<string | null> {
  if (!title.trim()) return null;
  const t = title.trim();

  const existing = await db.positionRole.findFirst({
    where: { name: t, isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const count = await db.positionRole.count();
  const created = await db.positionRole.create({
    data: { name: t, sortOrder: count + 100 },
    select: { id: true },
  });
  return created.id;
}

/** 为用户绑定岗位 */
export async function bindUserPosition(userId: string, positionRoleId: string) {
  await db.userPosition.upsert({
    where: { userId },
    create: { userId, positionRoleId },
    update: { positionRoleId },
  });
}

function isUniqueConflict(err: unknown): boolean {
  return isUniqueViolation(err);
}

/** 为钉钉扫码用户自动创建本地账号 */
export async function createDingTalkUser(profile: DingTalkProfile) {
  const baseUsername = profile.nick || `dt_${profile.unionId.slice(0, 8)}`;

  const tryCreate = async (username: string) => {
    return db.user.create({
      data: {
        username,
        passwordHash: DUMMY_HASH,
        email: profile.email ?? null,
        avatar: profile.avatarUrl ?? null,
        externalSource: 'dingtalk',
        externalId: profile.unionId,
        dingtalkUserId: profile.dingtalkUserId ?? null,
        supervisorDingtalkUserId: profile.supervisorDingtalkUserId ?? null,
        supervisorName: profile.supervisorName ?? null,
        syncAt: new Date(),
        platformRole: 'user',
        role: 'user',
        status: 'active',
      },
    });
  };

  try {
    return await tryCreate(baseUsername);
  } catch (err: unknown) {
    if (!isUniqueConflict(err)) throw err;

    // 并发创建同一 unionId：直接返回已有用户
    const existingByExternal = await findDingTalkUser(profile.unionId);
    if (existingByExternal) return existingByExternal;

    // 用户名冲突：换后缀重试；若仍撞 external 唯一则再查一次
    const suffix = crypto.randomBytes(3).toString('hex');
    try {
      return await tryCreate(`${baseUsername}_${suffix}`);
    } catch (retryErr: unknown) {
      if (!isUniqueConflict(retryErr)) throw retryErr;
      const raced = await findDingTalkUser(profile.unionId);
      if (raced) return raced;
      throw retryErr;
    }
  }
}

/** 同步钉钉用户档案（昵称/头像/邮箱/岗位/直属上级变更时更新） */
export async function syncDingTalkUser(userId: string, profile: DingTalkProfile) {
  await db.user.update({
    where: { id: userId },
    data: {
      email: profile.email ?? undefined,
      avatar: profile.avatarUrl ?? undefined,
      dingtalkUserId: profile.dingtalkUserId ?? undefined,
      supervisorDingtalkUserId: profile.supervisorDingtalkUserId ?? undefined,
      supervisorName: profile.supervisorName ?? undefined,
      syncAt: new Date(),
    },
  });
}
