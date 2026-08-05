import { randomUUID } from 'node:crypto';
import { db, type DatabaseClient } from '@/lib/database';
import { getCorpAccessToken } from './token';

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
