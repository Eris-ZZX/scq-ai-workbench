import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextCli, 'build'], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, QE_BUILD_PHASE: '1' },
});

child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
