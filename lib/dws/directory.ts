import {
  asArray,
  asRecord,
  firstRecordArray,
  stringValue,
} from './cli-utils';
import type { DwsCli } from './cli';

export const DWS_ROOT_DEPARTMENT_ID = '1';
const DIRECTORY_PAGE_SIZE = 100;

export type DwsDepartmentSnapshot = {
  id: string;
  name: string;
  parentId: string | null;
};

export type DwsDirectoryUser = {
  id: string;
  username: string | null;
  name: string;
  email: string | null;
  avatar: string | null;
  title: string | null;
  departmentIds: string[];
  departmentOrders: Record<string, number>;
  supervisorId: string | null;
  supervisorName: string | null;
};

function field(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function normalizeIds(value: unknown) {
  return Array.from(new Set(
    asArray(value)
      .map(stringValue)
      .filter((item): item is string => Boolean(item)),
  ));
}

function normalizeOrders(value: unknown) {
  const orders: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (const item of value.map(asRecord)) {
      const id = stringValue(field(item, 'deptId', 'dept_id', 'departmentId', 'department_id'));
      const order = Number(field(item, 'order', 'sortOrder', 'sort_order'));
      if (id && Number.isFinite(order)) orders[id] = order;
    }
    return orders;
  }

  for (const [id, order] of Object.entries(asRecord(value))) {
    const numeric = Number(order);
    if (Number.isFinite(numeric)) orders[id] = numeric;
  }
  return orders;
}

export function normalizeDwsDepartment(
  value: Record<string, unknown>,
  fallbackParentId: string,
): DwsDepartmentSnapshot | null {
  const id = stringValue(field(value, 'id', 'deptId', 'dept_id', 'departmentId', 'department_id'));
  if (!id) return null;
  return {
    id,
    name: stringValue(field(value, 'name', 'title'))?.trim() || id,
    parentId: stringValue(field(value, 'parentId', 'parent_id')) ?? fallbackParentId,
  };
}

export function normalizeDwsUser(value: Record<string, unknown>): DwsDirectoryUser | null {
  const id = stringValue(field(value, 'userId', 'userid', 'user_id', 'id', 'orgUserId', 'org_user_id'));
  if (!id) return null;

  const departmentIds = normalizeIds(field(
    value,
    'departmentIds',
    'department_ids',
    'deptIdList',
    'dept_id_list',
    'departments',
    'depts',
  ));
  return {
    id,
    username: stringValue(field(value, 'username', 'jobNumber', 'job_number', 'employeeNo', 'employee_no')),
    name: stringValue(field(
      value,
      'name',
      'displayName',
      'display_name',
      'nick',
      'nickname',
      'orgUserName',
      'org_user_name',
    ))?.trim() || id,
    email: stringValue(field(
      value,
      'email',
      'workEmail',
      'work_email',
      'orgEmail',
      'org_email',
      'orgAuthEmail',
      'org_auth_email',
    )),
    avatar: stringValue(field(value, 'avatar', 'avatarUrl', 'avatar_url', 'photo')),
    title: stringValue(field(
      value,
      'title',
      'position',
      'jobTitle',
      'job_title',
      'orgTitle',
      'org_title',
    )),
    departmentIds,
    departmentOrders: normalizeOrders(field(value, 'departmentOrders', 'deptOrderList', 'dept_order_list')),
    supervisorId: stringValue(field(
      value,
      'supervisorId',
      'supervisor_id',
      'managerUserId',
      'manager_user_id',
      'managerId',
      'orgMasterUserId',
      'org_master_user_id',
    )),
    supervisorName: stringValue(field(
      value,
      'supervisorName',
      'supervisor_name',
      'managerName',
      'manager_name',
      'orgMasterDisplayName',
      'org_master_display_name',
    )),
  };
}

export function selectDwsPrimaryDepartmentId(
  departmentIds: string[],
  departments: Map<string, DwsDepartmentSnapshot>,
  orders: Record<string, number> = {},
) {
  const uniqueIds = Array.from(new Set(departmentIds));
  const leafIds = uniqueIds.filter((id) => !uniqueIds.some(
    (childId) => childId !== id && departments.get(childId)?.parentId === id,
  ));
  return leafIds.sort(
    (left, right) => (orders[right] ?? 0) - (orders[left] ?? 0) || left.localeCompare(right),
  )[0] ?? null;
}

function mergeUsers(previous: DwsDirectoryUser, current: DwsDirectoryUser) {
  return {
    ...previous,
    ...current,
    username: current.username ?? previous.username,
    email: current.email ?? previous.email,
    avatar: current.avatar ?? previous.avatar,
    title: current.title ?? previous.title,
    supervisorId: current.supervisorId ?? previous.supervisorId,
    supervisorName: current.supervisorName ?? previous.supervisorName,
    departmentIds: Array.from(new Set([...previous.departmentIds, ...current.departmentIds])),
    departmentOrders: { ...previous.departmentOrders, ...current.departmentOrders },
  };
}

function recordsFrom(value: unknown, keys: string[]) {
  const root = asRecord(value);
  for (const key of keys) {
    const records = firstRecordArray(root[key], ['list', 'items', 'users', 'departments']);
    if (records.length) return records;
  }
  return firstRecordArray(value, ['list', 'items', 'users', 'departments']);
}

function nextPageArgs(value: unknown, page: number) {
  const record = asRecord(value);
  const pageInfo = asRecord(field(record, 'pageInfo', 'page_info', 'pagination'));
  const nextCursor = stringValue(field(
    record,
    'nextCursor',
    'next_cursor',
    'nextPageToken',
    'next_page_token',
  )) ?? stringValue(field(pageInfo, 'nextCursor', 'next_cursor', 'nextPageToken', 'next_page_token'));
  if (nextCursor) return ['--cursor', nextCursor];

  const hasMore = field(record, 'hasMore', 'has_more', 'hasNextPage', 'has_next_page')
    ?? field(pageInfo, 'hasMore', 'has_more', 'hasNextPage', 'has_next_page');
  if (hasMore === true) return ['--page', String(page + 1)];
  return [];
}

export function createDwsDirectoryProvider(cli: DwsCli) {
  return {
    async listDepartments() {
      const departments = new Map<string, DwsDepartmentSnapshot>([
        [DWS_ROOT_DEPARTMENT_ID, {
          id: DWS_ROOT_DEPARTMENT_ID,
          name: '组织目录',
          parentId: null,
        }],
      ]);
      const pending = [DWS_ROOT_DEPARTMENT_ID];
      const visited = new Set<string>();

      while (pending.length > 0) {
        const parentId = pending.shift();
        if (!parentId || visited.has(parentId)) continue;
        visited.add(parentId);
        let page = 1;
        let pagingArgs: string[] = [];
        do {
          const payload = await cli.run<unknown>([
            'contact',
            'dept',
            'list-children',
            '--dept',
            parentId,
            ...pagingArgs,
          ]);
          const children = recordsFrom(payload, ['result', 'departments', 'list', 'items']);
          for (const value of children) {
            const department = normalizeDwsDepartment(value, parentId);
            if (!department) continue;
            const isNew = !departments.has(department.id);
            departments.set(department.id, department);
            if (isNew) pending.push(department.id);
          }
          pagingArgs = nextPageArgs(payload, page);
          page += 1;
        } while (pagingArgs.length > 0);
      }

      return Array.from(departments.values());
    },

    async listUsers(departments: DwsDepartmentSnapshot[]) {
      const users = new Map<string, DwsDirectoryUser>();
      for (const department of departments) {
        let page = 1;
        let pagingArgs: string[] = [];
        do {
          const payload = await cli.run<unknown>([
            'contact',
            'dept',
            'list-members',
            '--depts',
            department.id,
            ...pagingArgs,
          ]);
          for (const value of recordsFrom(payload, ['deptUserList', 'result', 'users', 'members', 'list', 'items'])) {
            // CLI v1.x 成员包在 userInfo 里（deptUserList[].userInfo）
            const unwrapped = field(value, 'userInfo', 'user_info', 'user');
            const user = normalizeDwsUser(unwrapped ? asRecord(unwrapped) : value);
            if (!user) continue;
            if (!user.departmentIds.length) user.departmentIds = [department.id];
            const previous = users.get(user.id);
            users.set(user.id, previous ? mergeUsers(previous, user) : user);
          }
          pagingArgs = nextPageArgs(payload, page);
          page += 1;
        } while (pagingArgs.length > 0);
      }

      const ids = Array.from(users.keys());
      for (let offset = 0; offset < ids.length; offset += DIRECTORY_PAGE_SIZE) {
        const chunk = ids.slice(offset, offset + DIRECTORY_PAGE_SIZE);
        const payload = await cli.run<unknown>([
          'contact',
          'user',
          'get',
          '--ids',
          chunk.join(','),
        ]);
        for (const value of recordsFrom(payload, ['result', 'users', 'list', 'items'])) {
          // CLI v1.x 用户详情在 orgEmployeeModel 里
          const unwrapped = field(value, 'orgEmployeeModel', 'userInfo', 'user_info', 'user');
          const user = normalizeDwsUser(unwrapped ? asRecord(unwrapped) : value);
          if (!user) continue;
          const previous = users.get(user.id);
          users.set(user.id, previous ? mergeUsers(previous, user) : user);
        }
      }

      return Array.from(users.values());
    },
  };
}
