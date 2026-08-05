import { spawn } from 'node:child_process';
export {
  asArray,
  asRecord,
  firstRecordArray,
  stringValue,
} from './cli-utils';

export class DwsCliError extends Error {
  readonly retryable: boolean;
  readonly exitCode: number | null;

  constructor(
    message: string,
    options: { retryable?: boolean; exitCode?: number | null } = {},
  ) {
    super(message);
    this.name = 'DwsCliError';
    this.retryable = options.retryable ?? true;
    this.exitCode = options.exitCode ?? null;
  }
}

export type DwsCli = {
  run<T = unknown>(args: string[], options?: { timeoutMs?: number }): Promise<T>;
};

function commandName() {
  return process.env.DWS_CLI_COMMAND?.trim() || 'dws';
}

function normalizeOutput(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const candidate = value as Record<string, unknown>;
  if ('data' in candidate) return candidate.data;
  if ('result' in candidate && Object.keys(candidate).length <= 3) return candidate.result;
  return value;
}

export function createDwsCli(): DwsCli {
  return {
    async run<T>(
      args: string[],
      options: { timeoutMs?: number } = {},
    ) {
      const timeoutMs = options.timeoutMs ?? Number(process.env.DWS_CLI_TIMEOUT_MS ?? 30_000);
      const commandArgs = args.includes('--format') ? args : [...args, '--format', 'json'];

      return new Promise<T>((resolve, reject) => {
        const child = spawn(commandName(), commandArgs, {
          shell: false,
          windowsHide: true,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          reject(new DwsCliError(`dws 命令超时：${args.join(' ')}`));
        }, timeoutMs);

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          stdout += chunk;
        });
        child.stderr.on('data', (chunk: string) => {
          stderr += chunk;
        });
        child.once('error', (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new DwsCliError(`无法启动 dws：${error.message}`));
        });
        child.once('close', (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (code !== 0) {
            const detail = (stderr || stdout).trim().slice(0, 500);
            reject(new DwsCliError(
              `dws 命令失败(${code ?? 'unknown'})：${args.join(' ')}${detail ? `；${detail}` : ''}`,
              { exitCode: code },
            ));
            return;
          }
          try {
            const parsed: unknown = JSON.parse(stdout.trim() || 'null');
            resolve(normalizeOutput(parsed) as T);
          } catch {
            reject(new DwsCliError('dws 返回内容不是有效 JSON', { retryable: false }));
          }
        });
      });
    },
  };
}

