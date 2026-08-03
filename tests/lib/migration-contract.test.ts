import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'drizzle', '0000_initial.sql'), 'utf8');

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
