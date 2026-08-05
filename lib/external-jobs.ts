import { randomUUID } from 'node:crypto';
import { db } from '@/lib/database';

export const EXTERNAL_JOB_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
] as const;

export type ExternalJobStatus = (typeof EXTERNAL_JOB_STATUSES)[number];

export type ExternalJob = {
  id: string;
  kind: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: ExternalJobStatus;
  attempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  result: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExternalJobRow = {
  id: string;
  kind: string;
  idempotency_key: string;
  payload: string;
  status: ExternalJobStatus;
  attempts: number;
  available_at: Date;
  locked_at: Date | null;
  locked_by: string | null;
  last_error: string | null;
  result: string | null;
  created_at: Date;
  updated_at: Date;
};

const MAX_ERROR_LENGTH = 2_000;

function parseJson(value: string | null, fallback: Record<string, unknown> | null = null) {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : fallback;
  } catch {
    return fallback;
  }
}

function toJob(row: ExternalJobRow): ExternalJob {
  return {
    id: row.id,
    kind: row.kind,
    idempotencyKey: row.idempotency_key,
    payload: parseJson(row.payload, {}) ?? {},
    status: row.status,
    attempts: row.attempts,
    availableAt: new Date(row.available_at),
    lockedAt: row.locked_at ? new Date(row.locked_at) : null,
    lockedBy: row.locked_by,
    lastError: row.last_error,
    result: parseJson(row.result),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function enqueueExternalJob(input: {
  kind: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
}) {
  const id = randomUUID();
  const payload = JSON.stringify(input.payload ?? {});
  const rows = await db.$queryRaw<ExternalJobRow[]>`
    INSERT INTO external_job_outbox (
      id, kind, idempotency_key, payload, status, attempts, available_at,
      created_at, updated_at
    )
    VALUES (
      ${id}, ${input.kind}, ${input.idempotencyKey}, ${payload}, 'pending', 0,
      COALESCE(${input.availableAt ?? null}, now()), now(), now()
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET
      idempotency_key = EXCLUDED.idempotency_key
    RETURNING *
  `;
  const row = rows[0];
  if (!row) throw new Error('创建外部任务失败');
  return toJob(row);
}

export async function claimExternalJobs(input: {
  workerId: string;
  limit?: number;
  staleAfterMs?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 100);
  const staleAfter = new Date(Date.now() - (input.staleAfterMs ?? 10 * 60_000));
  const rows = await db.$queryRaw<ExternalJobRow[]>`
    WITH candidates AS (
      SELECT id
      FROM external_job_outbox
      WHERE (
        status = 'pending'
        AND available_at <= now()
      ) OR (
        status = 'processing'
        AND locked_at < ${staleAfter}
      )
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE external_job_outbox AS jobs
    SET status = 'processing',
        attempts = jobs.attempts + 1,
        locked_at = now(),
        locked_by = ${input.workerId},
        updated_at = now()
    FROM candidates
    WHERE jobs.id = candidates.id
    RETURNING jobs.*
  `;
  return rows.map(toJob);
}

export async function markExternalJobSucceeded(
  id: string,
  workerId: string,
  result: Record<string, unknown> = {},
) {
  const rows = await db.$queryRaw<ExternalJobRow[]>`
    UPDATE external_job_outbox
    SET status = 'succeeded',
        result = ${JSON.stringify(result)},
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now()
    WHERE id = ${id}
      AND status = 'processing'
      AND locked_by = ${workerId}
    RETURNING *
  `;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function markExternalJobFailed(input: {
  id: string;
  workerId: string;
  error: unknown;
  retryAt?: Date;
  retryable: boolean;
}) {
  const message = (input.error instanceof Error ? input.error.message : String(input.error))
    .slice(0, MAX_ERROR_LENGTH);
  const status: ExternalJobStatus = input.retryable ? 'pending' : 'failed';
  const rows = await db.$queryRaw<ExternalJobRow[]>`
    UPDATE external_job_outbox
    SET status = ${status},
        available_at = COALESCE(${input.retryAt ?? null}, now()),
        last_error = ${message},
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now()
    WHERE id = ${input.id}
      AND status = 'processing'
      AND locked_by = ${input.workerId}
    RETURNING *
  `;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function getExternalJob(id: string) {
  const rows = await db.$queryRaw<ExternalJobRow[]>`
    SELECT *
    FROM external_job_outbox
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function getLatestExternalJob(kind?: string) {
  const rows = kind
    ? await db.$queryRaw<ExternalJobRow[]>`
      SELECT *
      FROM external_job_outbox
      WHERE kind = ${kind}
      ORDER BY created_at DESC
      LIMIT 1
    `
    : await db.$queryRaw<ExternalJobRow[]>`
      SELECT *
      FROM external_job_outbox
      ORDER BY created_at DESC
      LIMIT 1
    `;
  return rows[0] ? toJob(rows[0]) : null;
}

export async function listExternalJobs(input: {
  status?: ExternalJobStatus;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = input.status
    ? await db.$queryRaw<ExternalJobRow[]>`
      SELECT *
      FROM external_job_outbox
      WHERE status = ${input.status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    : await db.$queryRaw<ExternalJobRow[]>`
      SELECT *
      FROM external_job_outbox
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  return rows.map(toJob);
}

export function retryDelayForAttempt(attempt: number) {
  return Math.min(60 * 60_000, Math.max(5_000, 2 ** Math.min(attempt, 12) * 1_000));
}
