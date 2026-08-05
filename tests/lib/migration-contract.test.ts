import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeMigrationContent } from '../../scripts/check-migrations.mjs';

const migration = readFileSync(resolve(process.cwd(), 'drizzle', '0000_initial.sql'), 'utf8');
const ownerMigration = readFileSync(
  resolve(process.cwd(), 'drizzle', '0003_add_ai_resource_owner.sql'),
  'utf8',
);
const auditMigration = readFileSync(
  resolve(process.cwd(), 'drizzle', '0004_charming_dracula.sql'),
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

describe('AI resource audit migration contract', () => {
  it('creates an indexed append-only audit log without duplicating prior migrations', () => {
    expect(auditMigration).toContain('CREATE TABLE "ai_resource_audit_logs"');
    expect(auditMigration).toContain('"actor_username_snapshot" text NOT NULL');
    expect(auditMigration).toContain('"before_data" text');
    expect(auditMigration).toContain('"after_data" text');
    expect(auditMigration).toContain('ai_resource_audit_logs_created_at_idx');
    expect(auditMigration).not.toContain('ALTER TABLE "users" ADD COLUMN');
    expect(auditMigration).not.toContain('ALTER TABLE "ai_resources" ADD COLUMN "owner_id"');
  });
});

describe('migration safety preflight', () => {
  it('blocks high-risk destructive statements', () => {
    const result = analyzeMigrationContent(
      'ALTER TABLE "users" DROP COLUMN "legacy_name";',
      '0005_remove_legacy_name.sql',
    );

    expect(result.blocked).toEqual([
      expect.objectContaining({
        code: 'drop-column',
        line: 1,
        severity: 'block',
      }),
    ]);
  });

  it('reports non-null changes for review without blocking known backfill migrations', () => {
    const result = analyzeMigrationContent(
      [
        'UPDATE "users" SET "display_name" = \'unknown\' WHERE "display_name" IS NULL;',
        'ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;',
      ].join('\n'),
      '0006_backfill_display_name.sql',
    );

    expect(result.blocked).toHaveLength(0);
    expect(result.review).toEqual([
      expect.objectContaining({
        code: 'set-not-null',
        line: 2,
        severity: 'review',
      }),
    ]);
  });

  it('blocks non-null changes without a preceding backfill', () => {
    const result = analyzeMigrationContent(
      'ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;',
      '0006_require_display_name.sql',
    );

    expect(result.blocked).toEqual([
      expect.objectContaining({
        code: 'set-not-null',
        line: 1,
        severity: 'block',
      }),
    ]);
  });

  it('ignores destructive words in SQL comments', () => {
    const result = analyzeMigrationContent(
      [
        '-- DROP TABLE "old_table";',
        'CREATE TABLE "new_table" ("id" text PRIMARY KEY);',
      ].join('\n'),
      '0007_add_new_table.sql',
    );

    expect(result.findings).toHaveLength(0);
  });
});
