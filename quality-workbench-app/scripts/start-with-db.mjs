#!/usr/bin/env node
/**
 * Production/boot helper:
 * 1) Ensure DATABASE_URL (reuse existing, or build from POSTGRES_*)
 * 2) Wait until PostgreSQL accepts TCP connections
 * 3) prisma migrate deploy
 * 4) optional seed when RUN_SEED_ON_BOOT=true
 * 5) exec the given command (default: npm run start)
 *
 * Usage:
 *   node scripts/start-with-db.mjs
 *   node scripts/start-with-db.mjs npm run start
 *   node scripts/start-with-db.mjs --skip-migrate npm run start
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

function log(message) {
  console.log(`[start-with-db] ${message}`);
}

function fail(message) {
  console.error(`[start-with-db] ${message}`);
  process.exit(1);
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildDatabaseUrlFromPostgresEnv() {
  const user = trim(process.env.POSTGRES_USER) || 'qe';
  const password = trim(process.env.POSTGRES_PASSWORD);
  const db = trim(process.env.POSTGRES_DB) || 'qe';
  const host = trim(process.env.POSTGRES_HOST) || 'localhost';
  const port = trim(process.env.POSTGRES_PORT) || '5432';

  if (!password) {
    fail(
      'DATABASE_URL is unset and POSTGRES_PASSWORD is missing. ' +
        'Set DATABASE_URL, or set POSTGRES_PASSWORD (and optional POSTGRES_USER/DB/HOST/PORT).',
    );
  }

  if (process.env.NODE_ENV === 'production' && password === 'dev') {
    if (trim(process.env.ALLOW_DEV_POSTGRES_PASSWORD).toLowerCase() !== 'true') {
      fail(
        'POSTGRES_PASSWORD=dev is not allowed in production. ' +
          'Set a strong password, or set ALLOW_DEV_POSTGRES_PASSWORD=true for local compose only.',
      );
    }
    log('WARNING: ALLOW_DEV_POSTGRES_PASSWORD=true with POSTGRES_PASSWORD=dev');
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}?schema=public`;
}

function resolveDatabaseUrl() {
  const existing = trim(process.env.DATABASE_URL);
  if (existing) {
    if (!existing.startsWith('postgres://') && !existing.startsWith('postgresql://')) {
      fail('DATABASE_URL must be a PostgreSQL connection string');
    }
    log('Using existing DATABASE_URL');
    return existing;
  }

  const built = buildDatabaseUrlFromPostgresEnv();
  process.env.DATABASE_URL = built;
  log(
    `Built DATABASE_URL from POSTGRES_* ` +
      `(host=${trim(process.env.POSTGRES_HOST) || 'localhost'}, ` +
      `db=${trim(process.env.POSTGRES_DB) || 'qe'}, ` +
      `user=${trim(process.env.POSTGRES_USER) || 'qe'})`,
  );
  return built;
}

function parseDatabaseHostPort(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port || 5432),
  };
}

function waitForTcp(host, port, { timeoutMs = 60_000, intervalMs = 1_500 } = {}) {
  const started = Date.now();
  log(`Waiting for PostgreSQL at ${host}:${port} ...`);

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port });
      let settled = false;

      const done = (ok, error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (ok) {
          log(`PostgreSQL is reachable at ${host}:${port}`);
          resolve();
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          reject(error ?? new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      };

      socket.setTimeout(3_000);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false, new Error('socket timeout')));
      socket.on('error', (error) => done(false, error));
    };

    attempt();
  });
}

function run(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function execForeground(command, args) {
  const child = spawn(command, args, {
    cwd: appRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function parseArgs(argv) {
  const args = [...argv];
  let skipMigrate = trim(process.env.SKIP_MIGRATE_ON_BOOT).toLowerCase() === 'true';
  while (args[0]?.startsWith('--')) {
    const flag = args.shift();
    if (flag === '--skip-migrate') {
      skipMigrate = true;
      continue;
    }
    fail(`Unknown flag: ${flag}`);
  }
  return { skipMigrate, commandArgs: args };
}

async function main() {
  const { skipMigrate, commandArgs } = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl();
  const { host, port } = parseDatabaseHostPort(databaseUrl);

  const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS || 60_000);
  await waitForTcp(host, port, { timeoutMs });

  if (!skipMigrate) {
    log('Running prisma migrate deploy ...');
    await run('npx', ['prisma', 'migrate', 'deploy']);
    log('Migrations applied');
  } else {
    log('Skipping migrate (SKIP_MIGRATE_ON_BOOT / --skip-migrate)');
  }

  if (trim(process.env.RUN_SEED_ON_BOOT).toLowerCase() === 'true') {
    log('RUN_SEED_ON_BOOT=true → running db:seed');
    await run('npm', ['run', 'db:seed']);
  }

  const cmd = commandArgs.length ? commandArgs : ['npm', 'run', 'start'];
  const [command, ...args] = cmd;
  log(`Starting: ${cmd.join(' ')}`);
  execForeground(command, args);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
