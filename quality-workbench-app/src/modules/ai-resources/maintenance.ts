import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { supportsAiResourceRowLocks } from './config';
import { AiResourceError } from './errors';

const SETTINGS_ID = 'default';

type Tx = Prisma.TransactionClient;

export async function ensureModuleSettings(tx: Tx = prisma) {
  return tx.aiResourceModuleSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, maintenanceMode: false },
    update: {},
  });
}

/**
 * Lock ModuleSettings inside a write transaction, then reject if maintenance is on.
 * Call at the start of every mutating AI-resource transaction (before business writes).
 */
export async function assertWritableInTransaction(tx: Tx) {
  await ensureModuleSettings(tx);

  let maintenanceMode = false;

  if (supportsAiResourceRowLocks()) {
    const rows = await tx.$queryRaw<Array<{ maintenanceMode: boolean | number }>>`
      SELECT "maintenanceMode" FROM "AiResourceModuleSettings"
      WHERE id = ${SETTINGS_ID}
      FOR SHARE
    `;
    maintenanceMode = Boolean(rows[0]?.maintenanceMode);
  } else {
    const row = await tx.aiResourceModuleSettings.findUnique({ where: { id: SETTINGS_ID } });
    maintenanceMode = Boolean(row?.maintenanceMode);
  }

  if (maintenanceMode) {
    throw new AiResourceError('AI 资源库维护中，暂不可写入', 503, 'MAINTENANCE');
  }
}

/**
 * Take FOR UPDATE on settings and set maintenanceMode.
 * Waits for writers holding FOR SHARE to finish (on PostgreSQL).
 */
export async function setMaintenanceModeInTransaction(tx: Tx, enabled: boolean) {
  await ensureModuleSettings(tx);

  if (supportsAiResourceRowLocks()) {
    await tx.$executeRaw`
      SELECT 1 FROM "AiResourceModuleSettings"
      WHERE id = ${SETTINGS_ID}
      FOR UPDATE
    `;
  }

  return tx.aiResourceModuleSettings.update({
    where: { id: SETTINGS_ID },
    data: { maintenanceMode: enabled },
  });
}

export async function getMaintenanceMode() {
  const row = await ensureModuleSettings();
  return row.maintenanceMode;
}
