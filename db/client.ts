import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

const globalDatabase = globalThis as typeof globalThis & {
  __qePool?: Pool;
  __qeDatabase?: Database;
};

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required at runtime');
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  return value;
}

function integerEnvironment(name: string, fallback: number, minimum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

/** Import-safe: no environment validation or network connection happens until called. */
export function getPool(): Pool {
  if (!globalDatabase.__qePool) {
    globalDatabase.__qePool = new Pool({
      connectionString: connectionString(),
      // Startup holds one advisory-lock connection while bootstrap uses the pool.
      max: integerEnvironment('DB_POOL_MAX', 10, 2),
      connectionTimeoutMillis: integerEnvironment('DB_CONNECT_TIMEOUT_MS', 5_000, 100),
    });
  }
  return globalDatabase.__qePool;
}

/** Import-safe lazy Drizzle client. */
export function getDatabase(): Database {
  if (!globalDatabase.__qeDatabase) {
    globalDatabase.__qeDatabase = drizzle(getPool(), { schema });
  }
  return globalDatabase.__qeDatabase;
}

export async function withPgTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (!globalDatabase.__qePool) return;
  await globalDatabase.__qePool.end();
  delete globalDatabase.__qePool;
  delete globalDatabase.__qeDatabase;
}
