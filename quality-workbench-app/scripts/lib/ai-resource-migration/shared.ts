import { createHash } from 'node:crypto';
import path from 'node:path';

export const MIGRATION_LOCK_KEY = 'ai-resources-migration';

export const RUN_STATUS = {
  STAGING: 'STAGING',
  DB_COMMITTED: 'DB_COMMITTED',
  FILES_PROMOTED: 'FILES_PROMOTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

export const TERMINAL_RUN_STATUSES: RunStatus[] = [
  RUN_STATUS.COMPLETED,
  RUN_STATUS.ROLLED_BACK,
  RUN_STATUS.FAILED,
];

export const ENTITY_TYPES = {
  USER: 'User',
  MEMBERSHIP: 'Membership',
  RESOURCE: 'Resource',
  REVIEW_REQUEST: 'ReviewRequest',
  UPDATE_LOG: 'UpdateLog',
  FAVORITE: 'Favorite',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export type MigrationAction = 'CREATED' | 'UPDATED';

export type FileManifestEntry = {
  action: 'CREATED' | 'REUSED';
  sourceHash: string;
  targetPath: string;
  targetHash: string;
};

export type MigrationReport = {
  runId: string;
  mode: 'dry-run' | 'migrate' | 'resume' | 'rollback';
  startedAt: string;
  finishedAt?: string;
  sourceSqlitePath: string;
  sourceStoragePath: string;
  targetUploadsDir: string;
  sourceCounts: SourceCounts;
  summary?: MigrationSummary;
  fileManifest?: FileManifestEntry[];
  error?: string;
};

export type SourceCounts = {
  users: number;
  resources: number;
  reviewRequests: number;
  updateLogs: number;
  favorites: number;
};

export type MigrationSummary = {
  users: { created: number; updated: number };
  memberships: { created: number; updated: number };
  resources: { created: number; updated: number };
  reviewRequests: { created: number; updated: number };
  updateLogs: { created: number; updated: number };
  favorites: { created: number; updated: number };
  filesCreated: number;
  filesReused: number;
  effectiveAdmins: number;
};

export function isPostgresDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

/** Take PG advisory lock only when migration writes also target that Postgres. */
export function shouldUseMigrationAdvisoryLock(databaseUrl: string | undefined): boolean {
  if (!isPostgresDatabaseUrl(databaseUrl)) return false;
  return process.env.AI_RESOURCES_MIGRATE_TARGET === 'postgres';
}

export function resolveSourceStoragePath(sqlitePath: string): string {
  const override = process.env.SOURCE_STORAGE_PATH?.trim();
  if (override) return path.resolve(override);
  return path.resolve(path.dirname(sqlitePath), 'storage', 'uploads');
}

export function resolveTargetUploadsDir(cwd = process.cwd()): string {
  return path.join(cwd, 'storage', 'ai-resources', 'uploads');
}

export function resolveReportDir(cwd = process.cwd()): string {
  return path.join(cwd, 'storage', 'ai-resources', 'migration-reports');
}

export function resolveReportPath(runId: string, cwd = process.cwd()): string {
  return path.join(resolveReportDir(cwd), `${runId}.json`);
}

export function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function mapPortalRole(role: string): 'admin' | 'reviewer' | 'user' {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'REVIEWER':
      return 'reviewer';
    default:
      return 'user';
  }
}

export function rewriteAttachmentUrls(attachmentsJson: string | null): string | null {
  if (!attachmentsJson) return null;
  try {
    const parsed = JSON.parse(attachmentsJson) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return attachmentsJson;
    const rewritten = parsed.map((item) => {
      const url = typeof item.url === 'string' ? item.url : '';
      const nextUrl = url.replace(/^\/api\/files\//, '/api/ai-resources/files/');
      return { ...item, url: nextUrl };
    });
    return JSON.stringify(rewritten);
  } catch {
    return attachmentsJson;
  }
}

export function extractStoredFileName(url: string): string | null {
  const match = url.match(/\/api\/(?:ai-resources\/)?files\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function emptySummary(): MigrationSummary {
  return {
    users: { created: 0, updated: 0 },
    memberships: { created: 0, updated: 0 },
    resources: { created: 0, updated: 0 },
    reviewRequests: { created: 0, updated: 0 },
    updateLogs: { created: 0, updated: 0 },
    favorites: { created: 0, updated: 0 },
    filesCreated: 0,
    filesReused: 0,
    effectiveAdmins: 0,
  };
}
