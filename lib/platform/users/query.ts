const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export const PLATFORM_ROLES = new Set(['user', 'admin']);
export const WORKBENCH_ROLES = new Set(['user', 'manager', 'admin']);
export const ACCOUNT_STATUSES = new Set(['active', 'disabled']);
export const AI_RESOURCE_ROLES = new Set(['user', 'reviewer', 'admin']);
const SOURCES = new Set(['local', 'authing', 'dws', 'dingtalk']);
const DINGTALK_BINDING_STATES = new Set(['empty', 'present']);

export type PlatformUserListFilters = {
  query: string;
  page: number;
  pageSize: number;
  status: string;
  source: string;
  dingtalkBinding: string;
  platformRole: string;
  workbenchRole: string;
  aiResourceRole: string;
};

export function parsePlatformUserListFilters(searchParams: URLSearchParams): PlatformUserListFilters {
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const requestedPageSize = Number.parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE), 10);
  const status = searchParams.get('status')?.trim() ?? '';
  const source = searchParams.get('source')?.trim() ?? '';
  const dingtalkBinding = searchParams.get('dingtalkBinding')?.trim() ?? '';
  const platformRole = searchParams.get('platformRole')?.trim() ?? '';
  const workbenchRole = searchParams.get('workbenchRole')?.trim() ?? '';
  const aiResourceRole = searchParams.get('aiResourceRole')?.trim() ?? '';

  return {
    query: searchParams.get('q')?.trim().slice(0, 100) ?? '',
    page: Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1,
    pageSize: Number.isFinite(requestedPageSize)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize))
      : PAGE_SIZE,
    status: ACCOUNT_STATUSES.has(status) ? status : '',
    source: SOURCES.has(source) ? source : '',
    dingtalkBinding: DINGTALK_BINDING_STATES.has(dingtalkBinding) ? dingtalkBinding : '',
    platformRole: PLATFORM_ROLES.has(platformRole) ? platformRole : '',
    workbenchRole: WORKBENCH_ROLES.has(workbenchRole) ? workbenchRole : '',
    aiResourceRole: AI_RESOURCE_ROLES.has(aiResourceRole) ? aiResourceRole : '',
  };
}

export function buildPlatformUserWhere(filters: PlatformUserListFilters) {
  const conditions: Record<string, unknown>[] = [];

  if (filters.query) {
    conditions.push({
      OR: [
        { username: { contains: filters.query } },
        { displayName: { contains: filters.query } },
        { email: { contains: filters.query } },
      ],
    });
  }
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.platformRole) conditions.push({ platformRole: filters.platformRole });
  if (filters.workbenchRole) conditions.push({ role: filters.workbenchRole });

  if (filters.source === 'local') {
    conditions.push({ externalSource: null, directoryUserId: null });
  } else if (filters.source === 'authing') {
    conditions.push({ externalSource: 'authing' });
  } else if (filters.source === 'dws') {
    conditions.push({
      OR: [
        { externalSource: 'dws' },
        { AND: [{ externalSource: null }, { directoryUserId: { not: null } }] },
      ],
    });
  } else if (filters.source === 'dingtalk') {
    conditions.push({ externalSource: 'dingtalk' });
  }

  if (filters.dingtalkBinding === 'empty') {
    conditions.push({ OR: [{ unionid: null }, { unionid: '' }] });
  } else if (filters.dingtalkBinding === 'present') {
    conditions.push({ unionid: { not: null } });
    conditions.push({ unionid: { not: '' } });
  }

  if (filters.aiResourceRole === 'user') {
    conditions.push({
      OR: [
        { aiResourceMembership: { is: null } },
        { aiResourceMembership: { role: 'user' } },
      ],
    });
  } else if (filters.aiResourceRole) {
    conditions.push({ aiResourceMembership: { role: filters.aiResourceRole } });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}
