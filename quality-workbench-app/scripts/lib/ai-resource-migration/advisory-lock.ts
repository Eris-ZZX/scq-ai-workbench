import { Client } from 'pg';
import {
  MIGRATION_LOCK_KEY,
  isPostgresDatabaseUrl,
  shouldUseMigrationAdvisoryLock,
} from './shared';

/**
 * PostgreSQL advisory lock held on a dedicated pg.Client for the entire migrate/resume/rollback lifecycle.
 * Never acquire via Prisma pool $queryRaw — session locks must stay on this client.
 */
export class MigrationAdvisoryLock {
  private client: Client | null = null;
  private held = false;

  constructor(private readonly databaseUrl: string | undefined) {}

  get isActive() {
    return this.held;
  }

  async acquire(): Promise<void> {
    if (!shouldUseMigrationAdvisoryLock(this.databaseUrl)) {
      console.log('[migration] Skipping pg_advisory_lock (non-Postgres target)');
      return;
    }

    const url = this.databaseUrl;
    if (!url || !isPostgresDatabaseUrl(url)) {
      throw new Error('DATABASE_URL is required for PostgreSQL advisory locking');
    }

    this.client = new Client({ connectionString: url });
    await this.client.connect();
    try {
      await this.client.query(`SELECT pg_advisory_lock(hashtext($1))`, [MIGRATION_LOCK_KEY]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to acquire pg_advisory_lock on DATABASE_URL: ${detail || 'connection error'}`);
    }
    this.held = true;
    console.log('[migration] Acquired pg_advisory_lock');
  }

  async release(): Promise<void> {
    if (!this.client) return;

    try {
      if (this.held) {
        await this.client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [MIGRATION_LOCK_KEY]);
        console.log('[migration] Released pg_advisory_unlock');
      }
    } finally {
      this.held = false;
      await this.client.end();
      this.client = null;
    }
  }
}
