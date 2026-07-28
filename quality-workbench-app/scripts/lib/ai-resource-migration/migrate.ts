import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { DUMMY_HASH } from '@/lib/db/auth';
import { countEffectiveAdmins } from '@/modules/ai-resources/guards';
import { getMigrationPrisma } from './prisma-target';
import {
  ENTITY_TYPES,
  RUN_STATUS,
  emptySummary,
  hashValue,
  mapPortalRole,
  rewriteAttachmentUrls,
  type EntityType,
  type MigrationAction,
  type MigrationSummary,
} from './shared';
import type { SourceSnapshot, SourceUser } from './source';

type Tx = Prisma.TransactionClient;

/** Lazy target client (PG when DATABASE_URL is postgres, else local SQLite). */
const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getMigrationPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export type UserIdMap = Map<string, string>;

export async function ensureModuleSettingsRow() {
  await prisma.aiResourceModuleSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
}

export async function transitionRunStatus(runId: string, expected: string, next: string) {
  const result = await prisma.aiResourceMigrationRun.updateMany({
    where: { id: runId, status: expected },
    data: {
      status: next,
      finishedAt:
        next === RUN_STATUS.COMPLETED || next === RUN_STATUS.ROLLED_BACK || next === RUN_STATUS.FAILED
          ? new Date()
          : undefined,
    },
  });
  if (result.count !== 1) {
    throw new Error(`Run ${runId} status transition ${expected} → ${next} failed (count=${result.count})`);
  }
}

async function uniqueUsername(base: string, tx: Tx, excludeUserId?: string): Promise<string> {
  const trimmed = base.trim() || 'legacy-user';
  let candidate = trimmed.slice(0, 64);
  let suffix = 0;

  while (true) {
    const existing = await tx.user.findUnique({ where: { username: candidate } });
    if (!existing || existing.id === excludeUserId) return candidate;
    suffix += 1;
    candidate = `${trimmed.slice(0, 58)}_${suffix}`;
  }
}

function externalIdentity(user: SourceUser): { externalSource: string; externalId: string } {
  if (user.unionId) {
    return { externalSource: 'dingtalk', externalId: user.unionId };
  }
  return {
    externalSource: 'ai-resource-legacy',
    externalId: user.id || user.dingUserId,
  };
}

async function migrationItemExists(
  tx: Tx,
  runId: string,
  entityType: EntityType,
  legacyId: string,
): Promise<boolean> {
  const row = await tx.aiResourceMigrationItem.findUnique({
    where: {
      runId_entityType_legacyId: { runId, entityType, legacyId },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function writeMigrationItem(
  tx: Tx,
  params: {
    runId: string;
    entityType: EntityType;
    legacyId: string;
    targetId: string;
    action: MigrationAction;
    beforeData: unknown | null;
    afterHash: string;
  },
) {
  await tx.aiResourceMigrationItem.create({
    data: {
      runId: params.runId,
      entityType: params.entityType,
      legacyId: params.legacyId,
      targetId: params.targetId,
      action: params.action,
      beforeData: params.beforeData == null ? null : JSON.stringify(params.beforeData),
      afterHash: params.afterHash,
    },
  });
}

export async function migrateUsersAndMemberships(
  runId: string,
  snapshot: SourceSnapshot,
  summary: MigrationSummary,
): Promise<UserIdMap> {
  const userIdMap: UserIdMap = new Map();

  for (const sourceUser of snapshot.users) {
    await prisma.$transaction(async (tx) => {
      if (await migrationItemExists(tx, runId, ENTITY_TYPES.USER, sourceUser.id)) {
        const existingItem = await tx.aiResourceMigrationItem.findUniqueOrThrow({
          where: {
            runId_entityType_legacyId: {
              runId,
              entityType: ENTITY_TYPES.USER,
              legacyId: sourceUser.id,
            },
          },
        });
        userIdMap.set(sourceUser.id, existingItem.targetId);
        return;
      }

      const identity = externalIdentity(sourceUser);
      let targetUser = await tx.user.findUnique({
        where: {
          externalSource_externalId: {
            externalSource: identity.externalSource,
            externalId: identity.externalId,
          },
        },
      });

      let action: MigrationAction = 'CREATED';
      let beforeData: unknown | null = null;

      if (targetUser) {
        action = 'UPDATED';
        beforeData = targetUser;
        const username = await uniqueUsername(sourceUser.name, tx, targetUser.id);
        targetUser = await tx.user.update({
          where: { id: targetUser.id },
          data: {
            username,
            avatar: sourceUser.avatarUrl ?? targetUser.avatar,
            status: 'active',
          },
        });
      } else {
        const username = await uniqueUsername(sourceUser.name, tx);
        targetUser = await tx.user.create({
          data: {
            id: sourceUser.id,
            username,
            passwordHash: DUMMY_HASH,
            avatar: sourceUser.avatarUrl,
            role: 'user',
            status: 'active',
            externalSource: identity.externalSource,
            externalId: identity.externalId,
          },
        });
      }

      userIdMap.set(sourceUser.id, targetUser.id);
      summary.users[action === 'CREATED' ? 'created' : 'updated'] += 1;

      await writeMigrationItem(tx, {
        runId,
        entityType: ENTITY_TYPES.USER,
        legacyId: sourceUser.id,
        targetId: targetUser.id,
        action,
        beforeData,
        afterHash: hashValue(targetUser),
      });

      if (!(await migrationItemExists(tx, runId, ENTITY_TYPES.MEMBERSHIP, sourceUser.id))) {
        const mappedRole = mapPortalRole(sourceUser.role);
        const existingMembership = await tx.aiResourceMembership.findUnique({
          where: { userId: targetUser.id },
        });

        let membershipAction: MigrationAction = 'CREATED';
        let membershipBefore: unknown | null = null;
        let membership;

        if (existingMembership) {
          membershipAction = 'UPDATED';
          membershipBefore = existingMembership;
          membership = await tx.aiResourceMembership.update({
            where: { userId: targetUser.id },
            data: { role: mappedRole },
          });
        } else {
          membership = await tx.aiResourceMembership.create({
            data: {
              userId: targetUser.id,
              role: mappedRole,
            },
          });
        }

        summary.memberships[membershipAction === 'CREATED' ? 'created' : 'updated'] += 1;
        await writeMigrationItem(tx, {
          runId,
          entityType: ENTITY_TYPES.MEMBERSHIP,
          legacyId: sourceUser.id,
          targetId: membership.id,
          action: membershipAction,
          beforeData: membershipBefore,
          afterHash: hashValue(membership),
        });
      }
    });
  }

  return userIdMap;
}

export async function assertEffectiveAdmins() {
  const count = await countEffectiveAdmins();
  if (count < 1) {
    throw new Error('Precheck failed: zero effective AI resource admins after user/membership migration');
  }
  return count;
}

function mapUserId(userIdMap: UserIdMap, legacyUserId: string): string {
  const mapped = userIdMap.get(legacyUserId);
  if (!mapped) {
    throw new Error(`Missing user mapping for legacy user id ${legacyUserId}`);
  }
  return mapped;
}

export async function migrateResources(
  runId: string,
  snapshot: SourceSnapshot,
  userIdMap: UserIdMap,
  summary: MigrationSummary,
) {
  for (const source of snapshot.resources) {
    await prisma.$transaction(async (tx) => {
      if (await migrationItemExists(tx, runId, ENTITY_TYPES.RESOURCE, source.id)) return;

      const existing = await tx.aiResource.findFirst({
        where: { legacyId: source.id },
      });

      const data = {
        legacyId: source.id,
        name: source.name,
        type: source.type,
        summary: source.summary,
        tags: source.tags,
        ownerName: source.ownerName,
        visibilityScope: source.visibilityScope,
        visibleDeptIds: source.visibleDeptIds,
        visibleUserIds: source.visibleUserIds,
        status: source.status,
        archivedFromStatus: null,
        resourceUrl: source.resourceUrl,
        content: source.content,
        attachments: rewriteAttachmentUrls(source.attachments),
        extension: source.extension,
        extractedText: source.extractedText,
        currentVersion: source.currentVersion,
        viewCount: source.viewCount,
        createdAt: new Date(source.createdAt),
        updatedAt: new Date(source.updatedAt),
        createdById: mapUserId(userIdMap, source.createdById),
      };

      let action: MigrationAction = 'CREATED';
      let beforeData: unknown | null = null;
      let target;

      if (existing) {
        action = 'UPDATED';
        beforeData = existing;
        target = await tx.aiResource.update({ where: { id: existing.id }, data });
      } else {
        target = await tx.aiResource.create({ data: { id: source.id, ...data } });
      }

      summary.resources[action === 'CREATED' ? 'created' : 'updated'] += 1;
      await writeMigrationItem(tx, {
        runId,
        entityType: ENTITY_TYPES.RESOURCE,
        legacyId: source.id,
        targetId: target.id,
        action,
        beforeData,
        afterHash: hashValue(target),
      });
    });
  }
}

export async function migrateReviewRequests(
  runId: string,
  snapshot: SourceSnapshot,
  userIdMap: UserIdMap,
  summary: MigrationSummary,
) {
  for (const source of snapshot.reviewRequests) {
    await prisma.$transaction(async (tx) => {
      if (await migrationItemExists(tx, runId, ENTITY_TYPES.REVIEW_REQUEST, source.id)) return;

      const existing = await tx.aiResourceReviewRequest.findFirst({
        where: { legacyId: source.id },
      });

      const data = {
        legacyId: source.id,
        type: source.type,
        status: source.status,
        resourceId: source.resourceId,
        proposedData: source.proposedData,
        updateSummary: source.updateSummary,
        changedFields: source.changedFields,
        rejectReason: source.rejectReason,
        createdAt: new Date(source.createdAt),
        reviewedAt: source.reviewedAt ? new Date(source.reviewedAt) : null,
        requesterId: mapUserId(userIdMap, source.requesterId),
        reviewerId: source.reviewerId ? mapUserId(userIdMap, source.reviewerId) : null,
      };

      let action: MigrationAction = 'CREATED';
      let beforeData: unknown | null = null;
      let target;

      if (existing) {
        action = 'UPDATED';
        beforeData = existing;
        target = await tx.aiResourceReviewRequest.update({ where: { id: existing.id }, data });
      } else {
        target = await tx.aiResourceReviewRequest.create({ data: { id: source.id, ...data } });
      }

      summary.reviewRequests[action === 'CREATED' ? 'created' : 'updated'] += 1;
      await writeMigrationItem(tx, {
        runId,
        entityType: ENTITY_TYPES.REVIEW_REQUEST,
        legacyId: source.id,
        targetId: target.id,
        action,
        beforeData,
        afterHash: hashValue(target),
      });
    });
  }
}

export async function migrateUpdateLogs(
  runId: string,
  snapshot: SourceSnapshot,
  userIdMap: UserIdMap,
  summary: MigrationSummary,
) {
  for (const source of snapshot.updateLogs) {
    await prisma.$transaction(async (tx) => {
      if (await migrationItemExists(tx, runId, ENTITY_TYPES.UPDATE_LOG, source.id)) return;

      const existing = await tx.aiResourceUpdateLog.findFirst({
        where: { legacyId: source.id },
      });

      const data = {
        legacyId: source.id,
        resourceId: source.resourceId,
        actorId: mapUserId(userIdMap, source.actorId),
        reviewerId: source.reviewerId ? mapUserId(userIdMap, source.reviewerId) : null,
        reviewId: source.reviewId,
        action: source.action,
        result: source.result,
        updateSummary: source.updateSummary,
        changedFields: source.changedFields,
        createdAt: new Date(source.createdAt),
      };

      let action: MigrationAction = 'CREATED';
      let beforeData: unknown | null = null;
      let target;

      if (existing) {
        action = 'UPDATED';
        beforeData = existing;
        target = await tx.aiResourceUpdateLog.update({ where: { id: existing.id }, data });
      } else {
        target = await tx.aiResourceUpdateLog.create({ data: { id: source.id, ...data } });
      }

      summary.updateLogs[action === 'CREATED' ? 'created' : 'updated'] += 1;
      await writeMigrationItem(tx, {
        runId,
        entityType: ENTITY_TYPES.UPDATE_LOG,
        legacyId: source.id,
        targetId: target.id,
        action,
        beforeData,
        afterHash: hashValue(target),
      });
    });
  }
}

export async function migrateFavorites(
  runId: string,
  snapshot: SourceSnapshot,
  userIdMap: UserIdMap,
  summary: MigrationSummary,
) {
  for (const source of snapshot.favorites) {
    await prisma.$transaction(async (tx) => {
      if (await migrationItemExists(tx, runId, ENTITY_TYPES.FAVORITE, source.id)) return;

      const userId = mapUserId(userIdMap, source.userId);
      const existing = await tx.aiResourceFavorite.findFirst({
        where: { legacyId: source.id },
      });

      const data = {
        legacyId: source.id,
        userId,
        resourceId: source.resourceId,
        createdAt: new Date(source.createdAt),
      };

      let action: MigrationAction = 'CREATED';
      let beforeData: unknown | null = null;
      let target;

      if (existing) {
        action = 'UPDATED';
        beforeData = existing;
        target = await tx.aiResourceFavorite.update({ where: { id: existing.id }, data });
      } else {
        target = await tx.aiResourceFavorite.create({ data: { id: source.id, ...data } });
      }

      summary.favorites[action === 'CREATED' ? 'created' : 'updated'] += 1;
      await writeMigrationItem(tx, {
        runId,
        entityType: ENTITY_TYPES.FAVORITE,
        legacyId: source.id,
        targetId: target.id,
        action,
        beforeData,
        afterHash: hashValue(target),
      });
    });
  }
}

export async function migrateDatabasePhase(
  runId: string,
  snapshot: SourceSnapshot,
): Promise<{ summary: MigrationSummary; userIdMap: UserIdMap }> {
  const summary = emptySummary();
  const userIdMap = await migrateUsersAndMemberships(runId, snapshot, summary);
  summary.effectiveAdmins = await assertEffectiveAdmins();
  await migrateResources(runId, snapshot, userIdMap, summary);
  await migrateReviewRequests(runId, snapshot, userIdMap, summary);
  await migrateUpdateLogs(runId, snapshot, userIdMap, summary);
  await migrateFavorites(runId, snapshot, userIdMap, summary);
  return { summary, userIdMap };
}

export function createInitialSummary(): MigrationSummary {
  return emptySummary();
}
