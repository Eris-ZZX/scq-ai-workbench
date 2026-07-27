import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { isPostgresDatabaseUrl } from './shared';

export type MigrationPrisma = PrismaClient;

let client: PrismaClient | null = null;
let pool: Pool | null = null;

/** Target is PostgreSQL when DATABASE_URL is postgres (app runtime is PG). */
export function shouldMigrateToPostgres() {
  return isPostgresDatabaseUrl(process.env.DATABASE_URL);
}

export function getMigrationPrisma(): PrismaClient {
  if (client) return client;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!shouldMigrateToPostgres() || !databaseUrl) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL for AI resource migration (app runtime is PostgreSQL).',
    );
  }

  pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  client = new PrismaClient({ adapter } as never);
  return client;
}

export async function disconnectMigrationPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}
