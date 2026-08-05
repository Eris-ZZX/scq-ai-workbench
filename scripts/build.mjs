import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const scriptDir = dirname(fileURLToPath(import.meta.url));

function finish(code, signal) {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
}

function runNextBuild() {
  const child = spawn(process.execPath, [nextCli, 'build'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, QE_BUILD_PHASE: '1' },
  });

  child.once('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once('exit', finish);
}

const migrationCheck = spawn(
  process.execPath,
  [join(scriptDir, 'check-migrations.mjs')],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  },
);

migrationCheck.once('error', (error) => {
  console.error(`[build] migration preflight failed to start: ${error.message}`);
  process.exitCode = 1;
});
migrationCheck.once('exit', (code, signal) => {
  if (signal || code !== 0) {
    finish(code, signal);
    return;
  }
  runNextBuild();
});
