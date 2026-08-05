import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { bootstrapDatabase } from './db/bootstrap';
import { getPool } from './db/client';
import { ensureStorageBucket } from './lib/storage';
import { assertAuthingConfiguration, authingRequired } from './lib/platform/auth/authing.config';

const STARTUP_LOCK_ID = '7152427805246271';
const globalRuntime = globalThis as typeof globalThis & {
  __qeInitialization?: Promise<void>;
  __qeCrashHandlersInstalled?: boolean;
};

const DATABASE_ATTEMPTS = 20;
const MIGRATION_ATTEMPTS = 3;
const BOOTSTRAP_ATTEMPTS = 3;
const STORAGE_ATTEMPTS = 20;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function retryDelay(attempt: number) {
  return Math.min(250 * attempt, 3_000);
}

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
  for (let attempt = 1; attempt <= DATABASE_ATTEMPTS; attempt += 1) {
    let client: PoolClient | undefined;
    try {
      client = await getPool().connect();
      await client.query('SELECT 1');
      console.info(`[startup] PostgreSQL ready on attempt ${attempt}/${DATABASE_ATTEMPTS}`);
      return client;
    } catch (error) {
      client?.release(true);
      lastError = error;
      console.warn(
        `[startup] PostgreSQL not ready (attempt ${attempt}/${DATABASE_ATTEMPTS}): ${errorMessage(error)}`,
      );
      if (attempt < DATABASE_ATTEMPTS) await delay(retryDelay(attempt));
    }
  }
  throw new Error('PostgreSQL did not become ready before the startup deadline', {
    cause: lastError,
  });
}

export async function retryPhase<T>(
  phase: string,
  operation: () => Promise<T>,
  attempts: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.info(`[startup] ${phase} attempt ${attempt}/${attempts}`);
      const result = await operation();
      console.info(`[startup] ${phase} ready`);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(
        `[startup] ${phase} failed (attempt ${attempt}/${attempts}): ${errorMessage(error)}`,
      );
      if (attempt < attempts) await delay(retryDelay(attempt));
    }
  }
  throw new Error(`${phase} failed after ${attempts} attempts`, { cause: lastError });
}

async function initialize() {
  installCrashHandlers();
  console.info('[startup] initialization begin');
  if (authingRequired()) {
    assertAuthingConfiguration();
    console.info('[startup] Authing configuration validated');
  }
  const lockClient = await waitForDatabase();
  let locked = false;
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [STARTUP_LOCK_ID]);
    locked = true;
    console.info('[startup] advisory lock acquired');

    await retryPhase(
      'database migration',
      () =>
        migrate(drizzle(lockClient), {
          migrationsFolder: join(process.cwd(), 'drizzle'),
        }),
      MIGRATION_ATTEMPTS,
    );
    await retryPhase('database bootstrap', bootstrapDatabase, BOOTSTRAP_ATTEMPTS);
    await retryPhase('MinIO bucket', ensureStorageBucket, STORAGE_ATTEMPTS);

    console.info('[startup] database, bootstrap data, and object storage are ready');
  } catch (error) {
    console.error(`[startup] initialization failed: ${errorMessage(error)}`);
    throw error;
  } finally {
    if (locked) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [STARTUP_LOCK_ID]);
        console.info('[startup] advisory lock released');
      } catch (error) {
        console.error(`[startup] advisory lock release failed: ${errorMessage(error)}`);
      }
    }
    lockClient.release();
  }
}

export function initializeNodeRuntime() {
  globalRuntime.__qeInitialization ??= initialize();
  return globalRuntime.__qeInitialization;
}
