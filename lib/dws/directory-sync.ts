import { randomUUID } from 'node:crypto';
import { db } from '@/lib/database';
import {
  createDwsDirectoryProvider,
  selectDwsPrimaryDepartmentId,
  type DwsDirectoryUser,
  type DwsDepartmentSnapshot,
} from './directory';
import type { DwsCli } from './cli';

export class DwsDirectorySyncError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable?: boolean } = {}) {
    super(message);
    this.name = 'DwsDirectorySyncError';
    this.retryable = options.retryable ?? true;
  }
}

type LocalUser = {
  id: string;
  username: string;
  email: string | null;
  directory_user_id: string | null;
};

export type DirectorySyncStatus = {
  status: 'idle' | 'queued' | 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  departmentCount?: number;
  directoryUserCount?: number;
  matchedUserCount?: number;
  unmatchedUserCount?: number;
  conflictCount?: number;
  error?: string;
};

const DIRECTORY_SYNC_SETTING_KEY = 'directory.organization.sync';

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || null;
}

function buildIndex(users: LocalUser[], key: (user: LocalUser) => string | null) {
  const result = new Map<string, LocalUser[]>();
  for (const user of users) {
    const value = key(user);
    if (!value) continue;
    const bucket = result.get(value) ?? [];
    bucket.push(user);
    result.set(value, bucket);
  }
  return result;
}

function matchLocalUser(
  directoryUser: DwsDirectoryUser,
  byDirectoryId: Map<string, LocalUser[]>,
  byUsername: Map<string, LocalUser[]>,
  byEmail: Map<string, LocalUser[]>,
) {
  const directoryCandidates = byDirectoryId.get(directoryUser.id) ?? [];
  const usernameCandidates = directoryUser.username
    ? byUsername.get(normalized(directoryUser.username)!) ?? []
    : [];
  const emailCandidates = directoryUser.email
    ? byEmail.get(normalized(directoryUser.email)!) ?? []
    : [];
  const preferredCandidates = directoryCandidates.length
    ? directoryCandidates
    : usernameCandidates.length
      ? usernameCandidates
      : emailCandidates;
  const candidates = new Map<string, LocalUser>();
  for (const candidate of preferredCandidates) {
    candidates.set(candidate.id, candidate);
  }
  if (candidates.size !== 1) {
    return {
      user: null,
      conflict: candidates.size > 1,
    };
  }
  return { user: Array.from(candidates.values())[0]!, conflict: false };
}

async function saveSyncStatus(status: DirectorySyncStatus) {
  await db.$queryRaw`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${DIRECTORY_SYNC_SETTING_KEY}, ${JSON.stringify(status)}, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

async function readLocalUsers() {
  return db.$queryRaw<LocalUser[]>`
    SELECT id, username, email, directory_user_id
    FROM users
  `;
}

async function persistDirectorySnapshot(
  departments: DwsDepartmentSnapshot[],
  directoryUsers: DwsDirectoryUser[],
  matches: Array<{ directoryUser: DwsDirectoryUser; user: LocalUser }>,
) {
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const now = new Date();

  await db.$transaction(async (transaction) => {
    for (const department of departments) {
      await transaction.$queryRaw`
        INSERT INTO dingtalk_departments (id, name, parent_id, sync_at)
        VALUES (${department.id}, ${department.name}, ${department.parentId}, ${now})
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          parent_id = EXCLUDED.parent_id,
          sync_at = EXCLUDED.sync_at
      `;
    }

    for (const { directoryUser, user } of matches) {
      const supervisorName = directoryUser.supervisorName
        ?? matches.find((candidate) => candidate.directoryUser.id === directoryUser.supervisorId)
          ?.directoryUser.name
        ?? null;
      await transaction.$queryRaw`
        UPDATE users
        SET directory_user_id = ${directoryUser.id},
            directory_supervisor_user_id = ${directoryUser.supervisorId},
            directory_supervisor_name = ${supervisorName},
            sync_at = ${now}
        WHERE id = ${user.id}
      `;

      await transaction.$queryRaw`
        DELETE FROM user_dingtalk_departments
        WHERE user_id = ${user.id}
      `;
      const primaryDepartmentId = selectDwsPrimaryDepartmentId(
        directoryUser.departmentIds,
        departmentMap,
        directoryUser.departmentOrders,
      );
      for (const departmentId of directoryUser.departmentIds) {
        if (!departmentMap.has(departmentId)) continue;
        await transaction.$queryRaw`
          INSERT INTO user_dingtalk_departments (
            id, user_id, department_id, is_primary, sync_at
          )
          VALUES (
            ${randomUUID()}, ${user.id}, ${departmentId},
            ${departmentId === primaryDepartmentId}, ${now}
          )
          ON CONFLICT (user_id, department_id)
          DO UPDATE SET is_primary = EXCLUDED.is_primary, sync_at = EXCLUDED.sync_at
        `;
      }

      if (directoryUser.title) {
        const positionRows = await transaction.$queryRaw<{ id: string }[]>`
          INSERT INTO position_roles (id, name, description, is_active, sort_order)
          VALUES (${randomUUID()}, ${directoryUser.title}, 'Synced from DWS directory', true, 0)
          ON CONFLICT (name)
          DO UPDATE SET is_active = true
          RETURNING id
        `;
        const positionId = positionRows[0]?.id;
        if (positionId) {
          await transaction.$queryRaw`
            INSERT INTO user_positions (
              id, user_id, position_role_id, effective_at, created_at, updated_at
            )
            VALUES (${randomUUID()}, ${user.id}, ${positionId}, ${now}, ${now}, ${now})
            ON CONFLICT (user_id)
            DO UPDATE SET position_role_id = EXCLUDED.position_role_id,
              effective_at = EXCLUDED.effective_at,
              updated_at = EXCLUDED.updated_at
          `;
        }
      }
    }

    await transaction.$queryRaw`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (
        ${DIRECTORY_SYNC_SETTING_KEY},
        ${JSON.stringify({
          status: 'success',
          startedAt: now.toISOString(),
          finishedAt: now.toISOString(),
          departmentCount: departments.length,
          directoryUserCount: directoryUsers.length,
          matchedUserCount: matches.length,
        } satisfies DirectorySyncStatus)},
        now()
      )
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  });
}

export async function syncDwsDirectory(cli: DwsCli) {
  const startedAt = new Date().toISOString();
  await saveSyncStatus({ status: 'running', startedAt });

  try {
    const provider = createDwsDirectoryProvider(cli);
    const departments = await provider.listDepartments();
    if (!departments.some((department) => department.id === '1')) {
      throw new DwsDirectorySyncError('DWS 组织目录缺少根部门', { retryable: false });
    }
    const directoryUsers = await provider.listUsers(departments);
    if (directoryUsers.length === 0) {
      throw new DwsDirectorySyncError('DWS 返回空成员目录，保留上次成功快照', { retryable: false });
    }

    const localUsers = await readLocalUsers();
    const byDirectoryId = buildIndex(localUsers, (user) => normalized(user.directory_user_id));
    const byUsername = buildIndex(localUsers, (user) => normalized(user.username));
    const byEmail = buildIndex(localUsers, (user) => normalized(user.email));
    const matches: Array<{ directoryUser: DwsDirectoryUser; user: LocalUser }> = [];
    let unmatchedUserCount = 0;
    let conflictCount = 0;

    for (const directoryUser of directoryUsers) {
      const result = matchLocalUser(directoryUser, byDirectoryId, byUsername, byEmail);
      if (!result.user) {
        unmatchedUserCount += 1;
        if (result.conflict) conflictCount += 1;
        continue;
      }
      matches.push({ directoryUser, user: result.user });
    }

    await persistDirectorySnapshot(departments, directoryUsers, matches);
    const finishedAt = new Date().toISOString();
    const report = {
      status: 'success' as const,
      startedAt,
      finishedAt,
      departmentCount: departments.length,
      directoryUserCount: directoryUsers.length,
      matchedUserCount: matches.length,
      unmatchedUserCount,
      conflictCount,
    };
    await saveSyncStatus(report);
    return report;
  } catch (error) {
    const report = {
      status: 'failed' as const,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    await saveSyncStatus(report);
    throw error;
  }
}

export async function getDirectorySyncStatus(): Promise<DirectorySyncStatus | null> {
  const rows = await db.$queryRaw<{ value: string }[]>`
    SELECT value
    FROM app_settings
    WHERE key = ${DIRECTORY_SYNC_SETTING_KEY}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as DirectorySyncStatus;
  } catch {
    return null;
  }
}
