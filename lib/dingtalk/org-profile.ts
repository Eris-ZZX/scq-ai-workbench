import { randomUUID } from 'node:crypto';
import { db } from '@/lib/database';
import { bindUserPosition, ensurePositionRole } from '@/lib/db/dingtalk';
import {
  selectPrimaryDepartmentId,
  type DingTalkDepartmentSnapshot,
} from './organization';
import {
  resolveDingTalkIdentityByUserId,
  type DingTalkIdentity,
} from './users';

export type AppliedDingTalkOrgProfile = {
  positionName: string | null;
  supervisorDingtalkUserId: string | null;
  supervisorName: string | null;
  primaryDepartmentId: string | null;
  departmentIds: string[];
};

async function resolveSupervisorName(managerUserId: string): Promise<string | null> {
  const local = await db.user.findFirst({
    where: { dingtalkUserId: managerUserId },
    select: { displayName: true, username: true },
  });
  if (local) {
    return local.displayName?.trim() || local.username || null;
  }

  const remote = await resolveDingTalkIdentityByUserId(managerUserId);
  return remote?.name ?? null;
}

async function syncDepartmentsByIdOnly(
  userId: string,
  departmentIds: string[],
  departmentOrders: Record<string, number>,
): Promise<string | null> {
  const uniqueIds = Array.from(new Set(departmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    await db.userDingTalkDepartment.deleteMany({ where: { userId } });
    return null;
  }

  const existing = await db.dingTalkDepartment.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, parentId: true },
  });
  const existingMap = new Map(existing.map((department) => [department.id, department]));

  const snapshots = new Map<string, DingTalkDepartmentSnapshot>();
  for (const departmentId of uniqueIds) {
    const current = existingMap.get(departmentId);
    snapshots.set(departmentId, {
      id: departmentId,
      name: current?.name?.trim() || departmentId,
      parentId: current?.parentId ?? null,
    });
  }

  const primaryDepartmentId = selectPrimaryDepartmentId(
    uniqueIds,
    snapshots,
    departmentOrders,
  );

  await db.$transaction(async (tx) => {
    for (const department of snapshots.values()) {
      await tx.dingTalkDepartment.upsert({
        where: { id: department.id },
        create: {
          id: department.id,
          name: department.name,
          parentId: department.parentId,
          syncAt: new Date(),
        },
        update: {
          // 保留已有名称；仅新建时用部门 ID 占位
          syncAt: new Date(),
        },
      });
    }

    await tx.userDingTalkDepartment.deleteMany({ where: { userId } });
    await tx.userDingTalkDepartment.createMany({
      data: uniqueIds.map((departmentId) => ({
        id: randomUUID(),
        userId,
        departmentId,
        isPrimary: departmentId === primaryDepartmentId,
        syncAt: new Date(),
      })),
    });
  });

  return primaryDepartmentId;
}

/**
 * 把钉钉用户详情中的岗位 / 直属上级 / 部门 ID 写入平台账号。
 * 部门只存 ID，不调用 department/get。
 */
export async function applyDingTalkOrgProfile(
  userId: string,
  identity: Pick<
    DingTalkIdentity,
    'title' | 'managerUserId' | 'departmentIds' | 'departmentOrders'
  >,
): Promise<AppliedDingTalkOrgProfile> {
  let positionName: string | null = null;
  const title = identity.title?.trim() || null;
  if (title) {
    const positionRoleId = await ensurePositionRole(title);
    if (positionRoleId) {
      await bindUserPosition(userId, positionRoleId);
      positionName = title;
    }
  }

  const managerUserId = identity.managerUserId?.trim() || null;
  let supervisorName: string | null = null;
  if (managerUserId) {
    supervisorName = await resolveSupervisorName(managerUserId);
  }

  await db.user.update({
    where: { id: userId },
    data: {
      supervisorDingtalkUserId: managerUserId,
      supervisorName,
      syncAt: new Date(),
    },
  });

  const primaryDepartmentId = await syncDepartmentsByIdOnly(
    userId,
    identity.departmentIds ?? [],
    identity.departmentOrders ?? {},
  );

  return {
    positionName,
    supervisorDingtalkUserId: managerUserId,
    supervisorName,
    primaryDepartmentId,
    departmentIds: identity.departmentIds ?? [],
  };
}
