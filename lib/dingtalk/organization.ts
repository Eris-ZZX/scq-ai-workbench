import { randomUUID } from 'node:crypto';
import { db, type DatabaseClient } from '@/lib/database';
import { getCorpAccessToken } from './token';
import { resolveUserIdByUnionId } from './users';

const ROOT_DEPARTMENT_ID = '1';
const PAGE_SIZE = 100;
const ORGANIZATION_SYNC_SETTING_KEY = 'dingtalk.organization.sync';

type DingTalkResponse<T> = {
  errcode?: number;
  errmsg?: string;
  result?: T;
};

export type DingTalkDepartmentSnapshot = {
  id: string;
  name: string;
  parentId: string | null;
};

export type DingTalkDirectoryUser = {
  userid?: string;
  unionid?: string;
  unionId?: string;
  dept_id_list?: Array<number | string>;
  deptIdList?: Array<number | string>;
  dept_order_list?: Array<{ dept_id?: number | string; deptId?: number | string; order?: number }> | Record<string, number>;
  deptOrderList?: Array<{ dept_id?: number | string; deptId?: number | string; order?: number }> | Record<string, number>;
};

export type DingTalkDepartmentOrderMap = Record<string, number>;

export class DingTalkOrganizationError extends Error {
  readonly code = 'DINGTALK_ORGANIZATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'DingTalkOrganizationError';
  }
}

export type DingTalkOrganizationSyncStatus = {
  status: 'idle' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  actorUsername?: string;
  departmentCount?: number;
  directoryUserCount?: number;
  matchedUserCount?: number;
  primaryGroupCount?: number;
  error?: string;
};

export function normalizeDepartmentIds(user: DingTalkDirectoryUser) {
  const values = user.dept_id_list ?? user.deptIdList ?? [];
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)));
}

export function normalizeDepartmentOrders(user: DingTalkDirectoryUser): DingTalkDepartmentOrderMap {
  const values = user.dept_order_list ?? user.deptOrderList;
  if (!values) return {};

  if (Array.isArray(values)) {
    return Object.fromEntries(
      values
        .filter((item) => item.dept_id !== undefined || item.deptId !== undefined)
        .map((item) => [
          String(item.dept_id ?? item.deptId),
          Number.isFinite(item.order) ? Number(item.order) : 0,
        ]),
    );
  }

  return Object.fromEntries(
    Object.entries(values).map(([departmentId, order]) => [
      String(departmentId),
      Number.isFinite(order) ? Number(order) : 0,
    ]),
  );
}

export function selectPrimaryDepartmentId(
  departmentIds: string[],
  departments: Map<string, DingTalkDepartmentSnapshot>,
  orders: DingTalkDepartmentOrderMap = {},
) {
  const uniqueIds = Array.from(new Set(departmentIds));
  const candidates = uniqueIds.filter((departmentId) => (
    !uniqueIds.some((childId) => (
      childId !== departmentId && departments.get(childId)?.parentId === departmentId
    ))
  ));

  return candidates
    .sort((left, right) => (
      (orders[right] ?? 0) - (orders[left] ?? 0)
      || left.localeCompare(right)
    ))[0] ?? null;
}

async function callDingTalk<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const accessToken = await getCorpAccessToken();
  if (!accessToken) {
    throw new DingTalkOrganizationError('未配置钉钉通讯录凭证');
  }

  const response = await fetch(`https://oapi.dingtalk.com${path}?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as DingTalkResponse<T>;
  if (!response.ok || payload.errcode !== 0 || !payload.result) {
    throw new DingTalkOrganizationError(
      `钉钉接口调用失败：${payload.errmsg ?? `HTTP ${response.status}`}`,
    );
  }
  return payload.result;
}

async function listDepartmentChildren(parentId: string) {
  const result = await callDingTalk<Array<{
    dept_id?: number | string;
    deptId?: number | string;
    name?: string;
    parent_id?: number | string;
    parentId?: number | string;
  }>>('/topapi/v2/department/listsub', {
    dept_id: Number(parentId),
    language: 'zh_CN',
  });

  return (Array.isArray(result) ? result : []).flatMap((department) => {
    const id = department.dept_id ?? department.deptId;
    if (id === undefined) return [];
    return [{
      id: String(id),
      name: department.name?.trim() || String(id),
      parentId: String(department.parent_id ?? department.parentId ?? parentId),
    }];
  });
}

export async function fetchDingTalkDepartments(): Promise<DingTalkDepartmentSnapshot[]> {
  const departments = new Map<string, DingTalkDepartmentSnapshot>([
    [ROOT_DEPARTMENT_ID, { id: ROOT_DEPARTMENT_ID, name: '钉钉组织', parentId: null }],
  ]);
  const pending = [ROOT_DEPARTMENT_ID];

  while (pending.length > 0) {
    const parentId = pending.shift()!;
    const children = await listDepartmentChildren(parentId);
    for (const child of children) {
      if (!departments.has(child.id)) pending.push(child.id);
      departments.set(child.id, child);
    }
  }

  return Array.from(departments.values());
}

async function listDepartmentUsers(departmentId: string) {
  const users: DingTalkDirectoryUser[] = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await callDingTalk<{
      list?: DingTalkDirectoryUser[];
      has_more?: boolean;
      hasMore?: boolean;
      next_cursor?: number;
      nextCursor?: number;
    }>('/topapi/v2/user/list', {
      dept_id: Number(departmentId),
      cursor,
      size: PAGE_SIZE,
      language: 'zh_CN',
      order_field: 'custom',
      contain_access_limit: false,
    });
    users.push(...(result.list ?? []));
    hasMore = Boolean(result.has_more ?? result.hasMore);
    const nextCursor = result.next_cursor ?? result.nextCursor;
    if (hasMore && nextCursor === undefined) {
      throw new DingTalkOrganizationError('钉钉部门用户分页缺少 next_cursor');
    }
    cursor = nextCursor ?? 0;
  }

  return users;
}

export async function fetchDingTalkDirectoryUsers(
  departments: DingTalkDepartmentSnapshot[],
): Promise<DingTalkDirectoryUser[]> {
  const users = new Map<string, DingTalkDirectoryUser>();
  for (const department of departments) {
    for (const user of await listDepartmentUsers(department.id)) {
      const key = user.userid ?? user.unionid ?? user.unionId;
      if (key) users.set(String(key), user);
    }
  }
  return Array.from(users.values());
}

async function fetchDepartmentSnapshot(departmentId: string): Promise<DingTalkDepartmentSnapshot> {
  const result = await callDingTalk<{
    dept_id?: number | string;
    deptId?: number | string;
    name?: string;
    parent_id?: number | string;
    parentId?: number | string;
  }>('/topapi/v2/department/get', {
    dept_id: Number(departmentId),
    language: 'zh_CN',
  });
  return {
    id: String(result.dept_id ?? result.deptId ?? departmentId),
    name: result.name?.trim() || departmentId,
    parentId: result.parent_id === undefined && result.parentId === undefined
      ? null
      : String(result.parent_id ?? result.parentId),
  };
}

export async function persistUserDingTalkDepartments(
  userId: string,
  departmentIds: string[],
  primaryDepartmentId: string | null,
  departments: Map<string, DingTalkDepartmentSnapshot>,
  tx: DatabaseClient = db,
) {
  await tx.userDingTalkDepartment.deleteMany({ where: { userId } });
  if (!departmentIds.length) return;

  await tx.userDingTalkDepartment.createMany({
    data: departmentIds
      .filter((departmentId) => departments.has(departmentId))
      .map((departmentId) => ({
        id: randomUUID(),
        userId,
        departmentId,
        isPrimary: departmentId === primaryDepartmentId,
        syncAt: new Date(),
      })),
  });
}

export async function syncUserDingTalkDepartments(
  userId: string,
  departmentIds: string[],
  orders: DingTalkDepartmentOrderMap = {},
) {
  const departmentSnapshots = await Promise.all(
    departmentIds.map((departmentId) => fetchDepartmentSnapshot(departmentId)),
  );
  const departments = new Map(departmentSnapshots.map((department) => [department.id, department]));
  const primaryDepartmentId = selectPrimaryDepartmentId(departmentIds, departments, orders);

  await db.$transaction(async (tx) => {
    for (const department of departmentSnapshots) {
      await tx.dingTalkDepartment.upsert({
        where: { id: department.id },
        create: { ...department, syncAt: new Date() },
        update: { name: department.name, parentId: department.parentId, syncAt: new Date() },
      });
    }
    await persistUserDingTalkDepartments(userId, departmentIds, primaryDepartmentId, departments, tx);
  });

  return { departmentIds, primaryDepartmentId };
}

export async function syncDingTalkOrganization() {
  const departments = await fetchDingTalkDepartments();
  const directoryUsers = await fetchDingTalkDirectoryUsers(departments);
  const existingUsers = await db.user.findMany({
    where: { externalSource: 'dingtalk' },
    select: { id: true, dingtalkUserId: true, externalId: true },
  });
  const usersByExternalId = new Map<string, { id: string }>();
  for (const user of existingUsers) {
    if (user.dingtalkUserId) usersByExternalId.set(user.dingtalkUserId, user);
    if (user.externalId) usersByExternalId.set(user.externalId, user);
  }
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const matchedUsers = directoryUsers.flatMap((directoryUser) => {
    const externalId = directoryUser.userid ?? directoryUser.unionid ?? directoryUser.unionId;
    if (!externalId) return [];
    const user = usersByExternalId.get(String(externalId));
    if (!user) return [];
    const departmentIds = normalizeDepartmentIds(directoryUser);
    return [{
      userId: user.id,
      departmentIds,
      primaryDepartmentId: selectPrimaryDepartmentId(
        departmentIds,
        departmentMap,
        normalizeDepartmentOrders(directoryUser),
      ),
    }];
  });

  await db.$transaction(async (tx) => {
    for (const department of departments) {
      await tx.dingTalkDepartment.upsert({
        where: { id: department.id },
        create: { ...department, syncAt: new Date() },
        update: { name: department.name, parentId: department.parentId, syncAt: new Date() },
      });
    }

    const existingUserIds = existingUsers.map((user) => user.id);
    if (existingUserIds.length) {
      await tx.userDingTalkDepartment.deleteMany({
        where: { userId: { in: existingUserIds } },
      });
    }

    const rows = matchedUsers.flatMap((matchedUser) => matchedUser.departmentIds
      .filter((departmentId) => departmentMap.has(departmentId))
      .map((departmentId) => ({
        id: randomUUID(),
        userId: matchedUser.userId,
        departmentId,
        isPrimary: departmentId === matchedUser.primaryDepartmentId,
        syncAt: new Date(),
      })));
    if (rows.length) await tx.userDingTalkDepartment.createMany({ data: rows });
  });

  return {
    departmentCount: departments.length,
    directoryUserCount: directoryUsers.length,
    matchedUserCount: matchedUsers.length,
    primaryGroupCount: matchedUsers.filter((user) => user.primaryDepartmentId).length,
  };
}

export async function getDingTalkOrganizationSyncStatus(): Promise<DingTalkOrganizationSyncStatus> {
  const setting = await db.appSetting.findUnique({
    where: { key: ORGANIZATION_SYNC_SETTING_KEY },
    select: { value: true },
  });
  if (!setting) return { status: 'idle' };
  try {
    return JSON.parse(setting.value) as DingTalkOrganizationSyncStatus;
  } catch {
    return { status: 'idle' };
  }
}

export async function saveDingTalkOrganizationSyncStatus(
  status: DingTalkOrganizationSyncStatus,
  updatedById?: string,
) {
  await db.appSetting.upsert({
    where: { key: ORGANIZATION_SYNC_SETTING_KEY },
    create: {
      key: ORGANIZATION_SYNC_SETTING_KEY,
      value: JSON.stringify(status),
      updatedById: updatedById ?? null,
    },
    update: {
      value: JSON.stringify(status),
      updatedById: updatedById ?? null,
      updatedAt: new Date(),
    },
  });
}

// ---- 用户详情刷新：工号 / 手机号 / 邮箱 / 岗位 / 直接上级 ----

const USER_REFRESH_SETTING_KEY = 'dingtalk.user.refresh';

export type DingTalkUserRefreshStatus = {
  status: 'idle' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  actorUsername?: string;
  total?: number;
  updated?: number;
  failed?: number;
  error?: string;
};

export async function getDingTalkUserRefreshStatus(): Promise<DingTalkUserRefreshStatus> {
  const setting = await db.appSetting.findUnique({
    where: { key: USER_REFRESH_SETTING_KEY },
    select: { value: true },
  });
  if (!setting) return { status: 'idle' };
  try {
    return JSON.parse(setting.value) as DingTalkUserRefreshStatus;
  } catch {
    return { status: 'idle' };
  }
}

export async function saveDingTalkUserRefreshStatus(
  status: DingTalkUserRefreshStatus,
  updatedById?: string,
) {
  await db.appSetting.upsert({
    where: { key: USER_REFRESH_SETTING_KEY },
    create: {
      key: USER_REFRESH_SETTING_KEY,
      value: JSON.stringify(status),
      updatedById: updatedById ?? null,
    },
    update: {
      value: JSON.stringify(status),
      updatedById: updatedById ?? null,
      updatedAt: new Date(),
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

type DingTalkUserDetail = {
  userid?: string;
  name?: string;
  email?: string;
  title?: string;
  job_number?: string;
  manager_userid?: string;
};

async function fetchDingTalkUserDetail(userid: string): Promise<DingTalkUserDetail> {
  return callDingTalk<DingTalkUserDetail>('/topapi/v2/user/get', {
    userid,
    language: 'zh_CN',
  });
}

const USER_DETAIL_BATCH_SIZE = 10;
const USER_DETAIL_BATCH_DELAY_MS = 200;

/**
 * 全量刷新钉钉用户的工号、邮箱、岗位、直接上级。
 * 只处理 externalSource='dingtalk' 的用户；单个用户失败不中断整体。
 */
export async function refreshDingTalkUserDetails(): Promise<{ total: number; updated: number; failed: number }> {
  const localUsers = await db.user.findMany({
    where: { externalSource: 'dingtalk' },
    select: { id: true, dingtalkUserId: true, externalId: true },
  });

  // 补全缺失的钉钉 userid
  const withUserIds: Array<{ id: string; dingtalkUserId: string }> = [];
  for (const user of localUsers) {
    if (user.dingtalkUserId) {
      withUserIds.push({ id: user.id, dingtalkUserId: user.dingtalkUserId });
      continue;
    }
    if (user.externalId) {
      const resolved = await resolveUserIdByUnionId(user.externalId);
      if (resolved) withUserIds.push({ id: user.id, dingtalkUserId: resolved });
    }
  }

  // 分批并发拉取详情（限流保护）
  const details = new Map<string, DingTalkUserDetail>();
  for (let offset = 0; offset < withUserIds.length; offset += USER_DETAIL_BATCH_SIZE) {
    const chunk = withUserIds.slice(offset, offset + USER_DETAIL_BATCH_SIZE);
    await Promise.all(chunk.map(async ({ dingtalkUserId }) => {
      try {
        details.set(dingtalkUserId, await fetchDingTalkUserDetail(dingtalkUserId));
      } catch (error) {
        console.error(`[dingtalk] 用户详情获取失败: ${dingtalkUserId}`, error);
      }
    }));
    if (offset + USER_DETAIL_BATCH_SIZE < withUserIds.length) {
      await new Promise((resolve) => setTimeout(resolve, USER_DETAIL_BATCH_DELAY_MS));
    }
  }

  // 补拉直接上级姓名
  const managerIds = [...new Set(
    Array.from(details.values())
      .map((detail) => detail.manager_userid)
      .filter((value): value is string => Boolean(value)),
  )];
  const managerNames = new Map<string, string>();
  for (const managerId of managerIds) {
    try {
      const manager = await fetchDingTalkUserDetail(managerId);
      if (manager.name) managerNames.set(managerId, manager.name);
    } catch {
      // 上级详情失败不阻塞主流程
    }
  }

  // 写库（有值才更新，避免权限缺失时清空既有数据）
  let updated = 0;
  let failed = 0;
  for (const { id, dingtalkUserId } of withUserIds) {
    const detail = details.get(dingtalkUserId);
    if (!detail) {
      failed += 1;
      continue;
    }
    try {
      await db.user.update({
        where: { id },
        data: {
          email: detail.email?.trim() || undefined,
          jobNumber: detail.job_number?.trim() || undefined,
          supervisorDingtalkUserId: detail.manager_userid || undefined,
          supervisorName: detail.manager_userid
            ? (managerNames.get(detail.manager_userid) ?? undefined)
            : undefined,
          syncAt: new Date(),
        },
      });
      if (detail.title?.trim()) {
        const roleId = await ensurePositionRole(detail.title);
        if (roleId) await bindUserPosition(id, roleId);
      }
      updated += 1;
    } catch (error) {
      console.error(`[dingtalk] 用户信息更新失败: ${id}`, error);
      failed += 1;
    }
  }

  return { total: withUserIds.length, updated, failed };
}
