import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/database';

const describeDatabase = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const templates = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'db', 'seed-data', 'quality-activity-template.json'),
    'utf8',
  ),
) as Array<{ stage: string; projectTaskName: string }>;
const parentCount = new Set(
  templates.map((row) => `${row.stage}::${row.projectTaskName}`),
).size;
const templateFilter = {
  version: { templateSet: { code: 'npq-quality-activity' } },
};

describeDatabase('Database bootstrap integration', () => {
  it('connects to PostgreSQL', async () => {
    const rows = await db.$queryRaw<Array<{ connected: number }>>`SELECT 1 AS connected`;
    expect(Number(rows[0]?.connected)).toBe(1);
  });

  it('contains the six default stage templates', async () => {
    const rows = await db.stageTemplate.findMany({
      where: { isDefault: true },
      orderBy: { order: 'asc' },
      select: { name: true },
    });
    expect(rows.map((row) => row.name)).toEqual([
      'TR1 概念评审',
      'TR2 方案评审',
      'TR3 样机评审',
      'TR4 试产评审',
      'TR5 量产准入',
      'TR6 项目结项',
    ]);
  });

  it('contains create-only roles and component configuration', async () => {
    expect(await db.positionRole.count()).toBeGreaterThanOrEqual(19);
    expect(await db.projectRole.count()).toBeGreaterThanOrEqual(6);
    expect(await db.componentConfig.count()).toBeGreaterThanOrEqual(9);
  });

  it('contains the NPQ templates without a sample project', async () => {
    expect(await db.activityTemplate.count()).toBe(templates.length);
    expect(await db.activityTemplateSet.count({
      where: { code: 'npq-quality-activity' },
    })).toBe(1);
    expect(await db.activityTemplateStage.count({ where: templateFilter })).toBe(6);
    expect(await db.activityTemplateParent.count({
      where: { stage: templateFilter },
    })).toBe(parentCount);
    expect(await db.activityTemplateChild.count({
      where: { parent: { stage: templateFilter } },
    })).toBe(templates.length);
    expect(await db.project.count()).toBe(0);
  });
});
