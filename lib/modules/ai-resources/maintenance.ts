import { db, type DatabaseClient } from '@/lib/database';

const SETTINGS_ID = 'default';

type Tx = DatabaseClient;

/** Ensure the module settings row exists (used by bootstrap/migrate scripts). */
export async function ensureModuleSettings(tx: Tx = db) {
  return tx.aiResourceModuleSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}
