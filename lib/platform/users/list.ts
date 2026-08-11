import { db } from '@/lib/database';
import {
  buildEmpOriginIndex,
  matchAuthingSupervisor,
  readAuthingExtendedString,
  type AuthingSupervisorMatch,
} from '@/platform/auth/authing-extended-fields';
import { buildPlatformUserWhere, type PlatformUserListFilters } from './query';

export const platformUserSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  avatar: true,
  platformRole: true,
  role: true,
  status: true,
  externalSource: true,
  externalId: true,
  dingtalkUserId: true,
  supervisorDingtalkUserId: true,
  supervisorName: true,
  directoryUserId: true,
  directorySupervisorUserId: true,
  directorySupervisorName: true,
  syncAt: true,
  createdAt: true,
  updatedAt: true,
  unionid: true,
  phoneNumber: true,
  phoneNumberVerified: true,
  emailVerified: true,
  address: true,
  birthdate: true,
  gender: true,
  locale: true,
  nickname: true,
  preferredUsername: true,
  profile: true,
  website: true,
  zoneinfo: true,
  externalIdAuthing: true,
  extendedFields: true,
  tenantId: true,
  userpoolId: true,
  roles: true,
  positionBinding: {
    select: {
      id: true,
      positionRoleId: true,
      positionRole: { select: { id: true, name: true, roleName: true, isActive: true } },
    },
  },
  aiResourceMembership: {
    select: { id: true, role: true, updatedAt: true },
  },
  projectMembers: {
    select: { id: true },
  },
  dingtalkDepartments: {
    where: { isPrimary: true },
    select: {
      department: {
        select: { id: true, name: true, parentId: true },
      },
    },
  },
} as const;

export function serializePlatformUser(
  user: any,
  supervisorOverride?: AuthingSupervisorMatch | null,
) {
  const position = Array.isArray(user.positionBinding)
    ? user.positionBinding[0] ?? null
    : user.positionBinding ?? null;
  const aiMembership = Array.isArray(user.aiResourceMembership)
    ? user.aiResourceMembership[0] ?? null
    : user.aiResourceMembership ?? null;
  const organizationBinding = Array.isArray(user.dingtalkDepartments)
    ? user.dingtalkDepartments[0] ?? null
    : user.dingtalkDepartments ?? null;

  const supervisor = supervisorOverride
    ? {
      directoryUserId: supervisorOverride.empOriginId,
      name: supervisorOverride.displayName || supervisorOverride.username,
    }
    : {
      directoryUserId: null,
      name: null,
    };

  return {
    ...user,
    source: user.externalSource || (user.directoryUserId ? 'dws' : 'local'),
    platformRole: user.platformRole ?? (user.role === 'admin' ? 'admin' : 'user'),
    workbenchRole: user.role,
    supervisor,
    directoryUserId: user.directoryUserId ?? null,
    organization: organizationBinding?.department ?? null,
    position,
    aiResourceRole: aiMembership?.role ?? 'user',
    aiResourceMembershipId: aiMembership?.id ?? null,
    projectCount: user.projectMembers?.length ?? 0,
    positionBinding: undefined,
    aiResourceMembership: undefined,
    role: undefined,
    projectMembers: undefined,
    dingtalkDepartments: undefined,
  };
}

async function loadAuthingSupervisorIndex(
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    extendedFields: string | null;
  }>,
) {
  const index = buildEmpOriginIndex(users);
  const missingLeaderIds = Array.from(new Set(
    users
      .map((user) => readAuthingExtendedString(user.extendedFields, 'emp_leader_origin_id'))
      .filter((leaderId): leaderId is string => leaderId !== null && !index.has(leaderId)),
  ));

  if (missingLeaderIds.length === 0) return index;

  const candidates = await db.user.findMany({
    where: {
      OR: missingLeaderIds.map((leaderId) => ({
        extendedFields: { contains: leaderId },
      })),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      extendedFields: true,
    },
  });

  for (const [empOriginId, match] of buildEmpOriginIndex(candidates)) {
    if (!index.has(empOriginId)) index.set(empOriginId, match);
  }
  return index;
}

export async function listPlatformUsers(filters: PlatformUserListFilters) {
  const where = buildPlatformUserWhere(filters);
  const [users, total, platformAdminCount, workbenchAdminCount, aiAdminCount] = await Promise.all([
    db.user.findMany({
      where,
      select: platformUserSelect,
      orderBy: { username: 'asc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    db.user.count({ where }),
    db.user.count({ where: { platformRole: 'admin', status: 'active' } }),
    db.user.count({ where: { role: 'admin', status: 'active' } }),
    db.aiResourceMembership.count({ where: { role: 'admin', user: { status: 'active' } } }),
  ]);

  const supervisorIndex = await loadAuthingSupervisorIndex(users);
  const totalCount = typeof total === 'number' ? total : 0;

  return {
    users: users.map((user) => serializePlatformUser(
      user,
      matchAuthingSupervisor(
        readAuthingExtendedString(user.extendedFields, 'emp_leader_origin_id'),
        supervisorIndex,
      ),
    )),
    safeguards: {
      activePlatformAdminCount: platformAdminCount,
      activeWorkbenchAdminCount: workbenchAdminCount,
      activeAiResourceAdminCount: aiAdminCount,
    },
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize),
      hasNextPage: filters.page * filters.pageSize < totalCount,
    },
  };
}
