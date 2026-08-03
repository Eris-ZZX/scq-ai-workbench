import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { bootstrapDatabase } from './db/bootstrap';
import { getPool } from './db/client';
import { ensureStorageBucket } from './lib/storage';

const STARTUP_LOCK_ID = '7152427805246271';
const globalRuntime = globalThis as typeof globalThis & {
  __qeInitialization?: Promise<void>;
  __qeCrashHandlersInstalled?: boolean;
};

function installCrashHandlers() {
  if (globalRuntime.__qeCrashHandlersInstalled) return;
  globalRuntime.__qeCrashHandlersInstalled = true;
  process.on('uncaughtExceptionMonitor', () => {
    console.error('[runtime] uncaught exception');
  });
  process.on('unhandledRejection', () => {
    console.error('[runtime] unhandled promise rejection');
    process.exitCode = 1;
  });
}

async function waitForDatabase(): Promise<PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    let client: PoolClient | undefined;
    try {
      client = await getPool().connect();
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      client?.release(true);
      lastError = error;
      if (attempt < 20) await delay(Math.min(250 * attempt, 3_000));
    }
  }
  throw new Error('PostgreSQL did not become ready before the startup deadline', {
    cause: lastError,
  });
}

async function initialize() {
  installCrashHandlers();
  const lockClient = await waitForDatabase();
  let locked = false;
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [STARTUP_LOCK_ID]);
    locked = true;
    await migrate(drizzle(lockClient), {
      migrationsFolder: join(process.cwd(), 'drizzle'),
    });
    await bootstrapDatabase();
    let storageError: unknown;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      try {
        await ensureStorageBucket();
        storageError = undefined;
        break;
      } catch (error) {
        storageError = error;
        if (attempt < 20) await delay(Math.min(250 * attempt, 3_000));
      }
    }
    if (storageError) {
      throw new Error('MinIO did not become ready before the startup deadline', {
        cause: storageError,
      });
    }
    console.info('[startup] database, bootstrap data, and object storage are ready');
  } finally {
    if (locked) {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [STARTUP_LOCK_ID]).catch(() => undefined);
    }
    lockClient.release();
  }
}

export function initializeNodeRuntime() {
  globalRuntime.__qeInitialization ??= initialize();
  return globalRuntime.__qeInitialization;
}
