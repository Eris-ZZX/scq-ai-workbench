import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { isAiResourcesEnabled } from '@/modules/ai-resources/config';
import { hashValue } from './shared';
import { ENTITY_TYPES, RUN_STATUS } from './shared';
import { rollbackCreatedFiles } from './files';
import { readMigrationReport } from './report';
import { transitionRunStatus } from './migrate';
import { getMigrationPrisma } from './prisma-target';

type Tx = Prisma.TransactionClient;

const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getMigrationPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

async function assertRollbackWritable(tx: Tx) {
  if (!isAiResourcesEnabled()) return;

  const settings = await tx.aiResourceModuleSettings.findUnique({ where: { id: 'default' } });
  if (!settings?.maintenanceMode) {
    throw new Error(
      'Rollback blocked: AI_RESOURCES_ENABLED=true requires maintenanceMode=true on AiResourceModuleSettings',
    );
  }
}

async function assertCurrentMatchesMigratedState(
  tx: Tx,
  entityType: string,
  targetId: string,
  afterHash: string | null | undefined,
) {
  if (!afterHash) return;

  let current: unknown = null;
  switch (entityType) {
    case ENTITY_TYPES.USER:
      current = await tx.user.findUnique({ where: { id: targetId } });
      break;
    case ENTITY_TYPES.MEMBERSHIP:
      current = await tx.aiResourceMembership.findUnique({ where: { id: targetId } });
      break;
    case ENTITY_TYPES.RESOURCE:
      current = await tx.aiResource.findUnique({ where: { id: targetId } });
      break;
    case ENTITY_TYPES.REVIEW_REQUEST:
      current = await tx.aiResourceReviewRequest.findUnique({ where: { id: targetId } });
      break;
    case ENTITY_TYPES.UPDATE_LOG:
      current = await tx.aiResourceUpdateLog.findUnique({ where: { id: targetId } });
      break;
    case ENTITY_TYPES.FAVORITE:
      current = await tx.aiResourceFavorite.findUnique({ where: { id: targetId } });
      break;
    default:
      return;
  }

  if (!current) return;
  const currentHash = hashValue(current);
  if (currentHash !== afterHash) {
    throw new Error(
      `Rollback afterHash conflict for ${entityType}/${targetId}: current ${currentHash} != migrated ${afterHash}`,
    );
  }
}

const ROLLBACK_ORDER = [
  ENTITY_TYPES.FAVORITE,
  ENTITY_TYPES.UPDATE_LOG,
  ENTITY_TYPES.REVIEW_REQUEST,
  ENTITY_TYPES.RESOURCE,
  ENTITY_TYPES.MEMBERSHIP,
  ENTITY_TYPES.USER,
] as const;

async function rollbackItem(tx: Tx, item: {
  entityType: string;
  targetId: string;
  action: string;
  beforeData: string | null;
  afterHash: string | null;
}) {
  if (isAiResourcesEnabled() && item.action === 'UPDATED') {
    await assertCurrentMatchesMigratedState(tx, item.entityType, item.targetId, item.afterHash);
  }

  if (item.action === 'CREATED') {
    switch (item.entityType) {
      case ENTITY_TYPES.FAVORITE:
        await tx.aiResourceFavorite.deleteMany({ where: { id: item.targetId } });
        break;
      case ENTITY_TYPES.UPDATE_LOG:
        await tx.aiResourceUpdateLog.deleteMany({ where: { id: item.targetId } });
        break;
      case ENTITY_TYPES.REVIEW_REQUEST:
        await tx.aiResourceReviewRequest.deleteMany({ where: { id: item.targetId } });
        break;
      case ENTITY_TYPES.RESOURCE:
        await tx.aiResource.deleteMany({ where: { id: item.targetId } });
        break;
      case ENTITY_TYPES.MEMBERSHIP:
        await tx.aiResourceMembership.deleteMany({ where: { id: item.targetId } });
        break;
      case ENTITY_TYPES.USER:
        await tx.aiResourceMembership.deleteMany({ where: { userId: item.targetId } });
        await tx.user.deleteMany({ where: { id: item.targetId } });
        break;
      default:
        break;
    }
    return;
  }

  if (item.action === 'UPDATED' && item.beforeData) {
    const before = JSON.parse(item.beforeData) as Record<string, unknown>;
    switch (item.entityType) {
      case ENTITY_TYPES.USER:
        await tx.user.update({ where: { id: item.targetId }, data: before as never });
        break;
      case ENTITY_TYPES.MEMBERSHIP:
        await tx.aiResourceMembership.update({ where: { id: item.targetId }, data: before as never });
        break;
      case ENTITY_TYPES.RESOURCE:
        await tx.aiResource.update({ where: { id: item.targetId }, data: before as never });
        break;
      case ENTITY_TYPES.REVIEW_REQUEST:
        await tx.aiResourceReviewRequest.update({ where: { id: item.targetId }, data: before as never });
        break;
      case ENTITY_TYPES.UPDATE_LOG:
        await tx.aiResourceUpdateLog.update({ where: { id: item.targetId }, data: before as never });
        break;
      case ENTITY_TYPES.FAVORITE:
        await tx.aiResourceFavorite.update({ where: { id: item.targetId }, data: before as never });
        break;
      default:
        break;
    }
  }
}

export async function rollbackMigrationRun(runId: string) {
  const run = await prisma.aiResourceMigrationRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new Error(`Migration run not found: ${runId}`);
  }
  if (run.status === RUN_STATUS.ROLLED_BACK) {
    console.log(`Run ${runId} already rolled back`);
    return;
  }

  const items = await prisma.aiResourceMigrationItem.findMany({
    where: { runId },
    orderBy: { id: 'desc' },
  });

  const originalStatus = run.status;

  await prisma.$transaction(async (tx) => {
    await assertRollbackWritable(tx);

    for (const entityType of ROLLBACK_ORDER) {
      const bucket = items.filter((item) => item.entityType === entityType);
      for (const item of bucket) {
        await rollbackItem(tx, item);
      }
    }
  });

  const report = await readMigrationReport(runId);
  if (report?.fileManifest?.length) {
    await rollbackCreatedFiles(report.fileManifest);
  }

  if (originalStatus !== RUN_STATUS.ROLLED_BACK) {
    await transitionRunStatus(runId, originalStatus, RUN_STATUS.ROLLED_BACK);
  }
}
