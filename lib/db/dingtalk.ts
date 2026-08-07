// lib/db/dingtalk.ts — 钉钉用户数据库操作
import { db, isUniqueViolation } from '@/lib/database';
import { DUMMY_HASH } from './auth';
import { syncUserDingTalkDepartments } from '@/lib/dingtalk/organization';
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
  /** 钉钉通讯录工号 */
  jobNumber?: string;
  /** 直属上级企业通讯录 userid */
  supervisorDingtalkUserId?: string;
  /** 直属上级姓名 */
  supervisorName?: string;
  /** 钉钉通讯录部门 ID */
  departmentIds?: string[];
  /** 用户在各部门中的排序，用于选择主小组 */
  departmentOrders?: Record<string, number>;
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
        unionid: profile.unionId,
        dingtalkUserId: profile.dingtalkUserId ?? null,
        jobNumber: profile.jobNumber ?? null,
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
    const created = await tryCreate(baseUsername);
    await syncProfileDepartments(created.id, profile);
    return created;
  } catch (err: unknown) {
    if (!isUniqueConflict(err)) throw err;

    // 并发创建同一 unionId：直接返回已有用户
    const existingByExternal = await findDingTalkUser(profile.unionId);
    if (existingByExternal) {
      await syncProfileDepartments(existingByExternal.id, profile);
      return existingByExternal;
    }

    // 用户名冲突：换后缀重试；若仍撞 external 唯一则再查一次
    const suffix = crypto.randomBytes(3).toString('hex');
    try {
      const created = await tryCreate(`${baseUsername}_${suffix}`);
      await syncProfileDepartments(created.id, profile);
      return created;
    } catch (retryErr: unknown) {
      if (!isUniqueConflict(retryErr)) throw retryErr;
      const raced = await findDingTalkUser(profile.unionId);
      if (raced) {
        await syncProfileDepartments(raced.id, profile);
        return raced;
      }
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
      unionid: profile.unionId ?? undefined,
      dingtalkUserId: profile.dingtalkUserId ?? undefined,
      jobNumber: profile.jobNumber ?? undefined,
      supervisorDingtalkUserId: profile.supervisorDingtalkUserId ?? undefined,
      supervisorName: profile.supervisorName ?? undefined,
      syncAt: new Date(),
    },
  });
  await syncProfileDepartments(userId, profile);
}

async function syncProfileDepartments(userId: string, profile: DingTalkProfile) {
  if (!profile.departmentIds) return;
  try {
    await syncUserDingTalkDepartments(userId, profile.departmentIds, profile.departmentOrders);
  } catch (error) {
    console.error('[dingtalk] organization sync failed:', error);
  }
}
