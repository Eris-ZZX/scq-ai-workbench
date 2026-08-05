import { db } from '@/lib/database';

const WORKER_HEALTH_SETTING = 'dws.worker.health';

export type DwsWorkerHealth = {
  workerId: string;
  heartbeatAt: string;
  mode: 'separate-worker';
  cliCommand: string;
  pendingJobs: number;
  failedJobs: number;
};

export type DwsWorkerStatus = {
  mode: 'separate-worker';
  healthy: boolean;
  worker: DwsWorkerHealth | null;
  webHasDwsCredentials: false;
  appBaseUrlConfigured: boolean;
};

export async function recordDwsWorkerHeartbeat(input: {
  workerId: string;
  pendingJobs: number;
  failedJobs: number;
}) {
  const health: DwsWorkerHealth = {
    workerId: input.workerId,
    heartbeatAt: new Date().toISOString(),
    mode: 'separate-worker',
    cliCommand: process.env.DWS_CLI_COMMAND?.trim() || 'dws',
    pendingJobs: input.pendingJobs,
    failedJobs: input.failedJobs,
  };
  await db.$queryRaw`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${WORKER_HEALTH_SETTING}, ${JSON.stringify(health)}, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return health;
}

export async function getDwsWorkerHealth() {
  const rows = await db.$queryRaw<{ value: string }[]>`
    SELECT value
    FROM app_settings
    WHERE key = ${WORKER_HEALTH_SETTING}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as DwsWorkerHealth;
  } catch {
    return null;
  }
}

export async function getDwsWorkerStatus(): Promise<DwsWorkerStatus> {
  const health = await getDwsWorkerHealth();
  const staleAfterMs = Math.max(
    30_000,
    Number(process.env.DWS_WORKER_INTERVAL_MS ?? 5_000) * 3,
  );
  const healthy = Boolean(
    health && Date.now() - new Date(health.heartbeatAt).getTime() <= staleAfterMs,
  );
  return {
    mode: 'separate-worker' as const,
    healthy,
    worker: health,
    webHasDwsCredentials: false,
    appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL?.trim()),
  };
}
