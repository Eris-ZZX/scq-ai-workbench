import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const ROOT = resolve(__dirname, '..', '..');
const CHECK_MIGRATIONS = join(ROOT, 'scripts', 'check-migrations.mjs');

/**
 * 模拟生产部署平台（公司自有 Dockerfile.app / 无法设置 build-arg）的关键行为。
 * 平台构建时不会设置 QE_ALLOW_DESTRUCTIVE_MIGRATIONS，
 * 因此迁移预检必须默认通过；必填环境变量必须在 .env.example 中有声明。
 */

describe('production deploy platform simulation', () => {
  it('migration preflight passes without QE_ALLOW_DESTRUCTIVE_MIGRATIONS', async () => {
    // 平台构建 env 不包含该变量
    const env = { ...process.env };
    delete env.QE_ALLOW_DESTRUCTIVE_MIGRATIONS;

    await expect(
      execFileAsync(process.execPath, [CHECK_MIGRATIONS], { env, cwd: ROOT }),
    ).resolves.toBeDefined();
  });

  it('every destructive migration carries the confirmed marker', async () => {
    const drizzleDir = join(ROOT, 'drizzle');
    const files = (await readdir(drizzleDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    // 逐个文件分析：破坏性变更（block）必须为空——要么无破坏性操作，要么已确认标记
    const unconfirmed: string[] = [];
    for (const file of files) {
      const source = await readFile(join(drizzleDir, file), 'utf8');
      const { blocked, confirmed } = await import(CHECK_MIGRATIONS)
        .then((mod) => mod.analyzeMigrationContent(source, file));
      if (blocked.length > 0 && !confirmed) {
        unconfirmed.push(`${file}: ${blocked.map((b) => b.code).join(', ')}`);
      }
    }

    expect(unconfirmed).toEqual([]);
  });

  it('every DROP TABLE migration is idempotent (IF EXISTS)', async () => {
    // 生产从旧分支（无该表）升级时，DROP 的表可能从未存在；
    // 不带 IF EXISTS 会导致迁移在部署时失败（42P01），app 无法启动
    const drizzleDir = join(ROOT, 'drizzle');
    const files = (await readdir(drizzleDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const risky: string[] = [];
    for (const file of files) {
      const source = await readFile(join(drizzleDir, file), 'utf8');
      // 找 DROP TABLE 语句，要求紧跟 IF EXISTS
      for (const match of source.matchAll(/\bDROP\s+TABLE\b/gi)) {
        const after = source.slice(match.index ?? 0, (match.index ?? 0) + 120);
        if (!/\bIF\s+EXISTS\b/i.test(after)) {
          risky.push(`${file}: DROP TABLE 未使用 IF EXISTS`);
        }
      }
    }

    expect(risky).toEqual([]);
  });

  it('required compose variables are declared in .env.example', async () => {
    const compose = await readFile(join(ROOT, 'docker-compose.yml'), 'utf8');
    const envExample = await readFile(join(ROOT, '.env.example'), 'utf8');

    // 提取 compose 中必填变量（${VAR:?...}）
    const required = new Set<string>();
    for (const match of compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)) {
      required.add(match[1]);
    }

    // 提取 .env.example 中声明的变量
    const declared = new Set<string>();
    for (const match of envExample.matchAll(/^([A-Z0-9_]+)=/gm)) {
      declared.add(match[1]);
    }

    const missing = [...required].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('.env.example has no removed DWS variables', async () => {
    const envExample = await readFile(join(ROOT, '.env.example'), 'utf8');
    const lines = envExample
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('DWS_') || line.includes('DWS_CONFIG'));

    expect(lines).toEqual([]);
  });
});
