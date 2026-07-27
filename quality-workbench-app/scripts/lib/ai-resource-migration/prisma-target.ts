import { PrismaClient } from '@/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { isPostgresDatabaseUrl } from './shared';

export type MigrationPrisma = PrismaClient;

let client: PrismaClient | null = null;
let pool: Pool | null = null;

/**
 * Whether migration business writes should target PostgreSQL.
 * Requires schema provider=postgresql (not yet the local default).
 * Opt-in: AI_RESOURCES_MIGRATE_TARGET=postgres + postgres DATABASE_URL.
 */
export function shouldMigrateToPostgres() {
  return (
    process.env.AI_RESOURCES_MIGRATE_TARGET === 'postgres' &&
    isPostgresDatabaseUrl(process.env.DATABASE_URL)
  );
}

/**
 * Target DB for migration writes.
 * - Opt-in postgres target → @prisma/adapter-pg
 * - otherwise → same local libsql/SQLite as the app (rehearsal path)
 */
export function getMigrationPrisma(): PrismaClient {
  if (client) return client;

  if (shouldMigrateToPostgres()) {
    const databaseUrl = process.env.DATABASE_URL!.trim();
    pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter } as never);
    return client;
  }

  if (isPostgresDatabaseUrl(process.env.DATABASE_URL)) {
    console.warn(
      '[migration] DATABASE_URL is PostgreSQL, but AI_RESOURCES_MIGRATE_TARGET is not postgres. ' +
        'Writing to local SQLite via libsql. Set AI_RESOURCES_MIGRATE_TARGET=postgres after switching schema provider to postgresql.',
    );
  }

  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '..', '..')];
  let dbFile = path.join(cwd, 'dev.db');
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'dev.db'))) {
      dbFile = path.join(dir, 'dev.db');
      break;
    }
  }
  const adapter = new PrismaLibSql({ url: `file:${dbFile}` });
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
