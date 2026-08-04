import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'drizzle', '0000_initial.sql'), 'utf8');
const ownerMigration = readFileSync(
  resolve(process.cwd(), 'drizzle', '0003_add_ai_resource_owner.sql'),
  'utf8',
);

describe('initial Drizzle migration contract', () => {
  it('creates all 40 tables and the full-text search support', () => {
    expect(migration.match(/CREATE TABLE /g)).toHaveLength(40);
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    expect(migration.match(/gin_trgm_ops/g)).toHaveLength(6);
  });

  it('preserves critical defaults and delete policies', () => {
    expect(migration).toContain('"has_blocked" boolean DEFAULT false NOT NULL');
    expect(migration).toContain('"changed_fields" text DEFAULT \'\' NOT NULL');
    expect(migration).toMatch(/task_creator_fkey[^;]+ON DELETE restrict/);
    expect(migration).toMatch(/observability_event_user_fkey[^;]+ON DELETE set null/);
  });
});

describe('AI resource owner migration contract', () => {
  it('backfills owners from active usernames and falls back to uploaders', () => {
    expect(ownerMigration).toContain('ALTER TABLE "ai_resources" ADD COLUMN "owner_id" text;');
    expect(ownerMigration).toContain('WHERE "username" = resource."owner_name"');
    expect(ownerMigration).toContain('AND "status" = \'active\'');
    expect(ownerMigration).toContain('resource."created_by_id"');
    expect(ownerMigration).toContain('ALTER COLUMN "owner_id" SET NOT NULL');
  });

  it('protects owner references and adds a lookup index', () => {
    expect(ownerMigration).toContain('ai_resource_owner_fkey');
    expect(ownerMigration).toContain('ON DELETE RESTRICT');
    expect(ownerMigration).toContain('ai_resources_owner_id_idx');
  });
});
