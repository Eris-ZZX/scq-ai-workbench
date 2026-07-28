import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

const SETTINGS_ID = 'default';

type Tx = Prisma.TransactionClient;

/** Ensure the module settings row exists (used by bootstrap/migrate scripts). */
export async function ensureModuleSettings(tx: Tx = prisma) {
  return tx.aiResourceModuleSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}
