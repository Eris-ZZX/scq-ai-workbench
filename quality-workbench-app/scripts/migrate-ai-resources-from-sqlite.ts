#!/usr/bin/env tsx
/**
 * AI Resources SQLite → workbench DB migration.
 *
 * Env:
 *   SOURCE_SQLITE_PATH — readonly portal SQLite snapshot
 *   DATABASE_URL       — when AI_RESOURCES_MIGRATE_TARGET=postgres and URL is postgres://,
 *                        business writes use @prisma/adapter-pg + dedicated advisory lock.
 *                        Otherwise writes rehearse against local libsql/SQLite (schema is sqlite today).
 *                        Production cutover requires switching prisma schema provider to postgresql first.
 *   SOURCE_STORAGE_PATH (optional) — portal uploads dir; defaults to <sqlite-dir>/storage/uploads
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { MigrationAdvisoryLock } from './lib/ai-resource-migration/advisory-lock';
import { promoteAttachmentFiles } from './lib/ai-resource-migration/files';
import {
  ensureModuleSettingsRow,
  migrateDatabasePhase,
  transitionRunStatus,
} from './lib/ai-resource-migration/migrate';
import { disconnectMigrationPrisma, getMigrationPrisma } from './lib/ai-resource-migration/prisma-target';
import { rollbackMigrationRun } from './lib/ai-resource-migration/rollback';
import {
  printDryRunPlan,
  printSourceCounts,
  printSummary,
  readMigrationReport,
  writeMigrationReport,
} from './lib/ai-resource-migration/report';
import {
  RUN_STATUS,
  TERMINAL_RUN_STATUSES,
  resolveReportPath,
  resolveSourceStoragePath,
  resolveTargetUploadsDir,
  type MigrationReport,
} from './lib/ai-resource-migration/shared';
import { openSourceDatabase, readSourceSnapshot } from './lib/ai-resource-migration/source';

type CliOptions = {
  dryRun: boolean;
  resumeRunId: string | null;
  rollbackRunId: string | null;
};

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, resumeRunId: null, rollbackRunId: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--resume') {
      options.resumeRunId = argv[++i] ?? null;
      if (!options.resumeRunId) throw new Error('--resume requires a runId argument');
    } else if (arg === '--rollback') {
      options.rollbackRunId = argv[++i] ?? null;
      if (!options.rollbackRunId) throw new Error('--rollback requires a runId argument');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireSourcePath(): string {
  const sourcePath = process.env.SOURCE_SQLITE_PATH?.trim();
  if (!sourcePath) {
    throw new Error('SOURCE_SQLITE_PATH is required');
  }
  return sourcePath;
}

async function runDryRun(sourceSqlitePath: string) {
  const sourceStoragePath = resolveSourceStoragePath(sourceSqlitePath);
  const targetUploadsDir = resolveTargetUploadsDir();
  const db = openSourceDatabase(sourceSqlitePath);
  try {
    const snapshot = readSourceSnapshot(db);
    const report: MigrationReport = {
      runId: 'dry-run',
      mode: 'dry-run',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      sourceSqlitePath,
      sourceStoragePath,
      targetUploadsDir,
      sourceCounts: snapshot.counts,
    };
    printDryRunPlan(report);
  } finally {
    db.close();
  }
}

async function resumeRun(runId: string, sourceSqlitePath: string) {
  const prisma = getMigrationPrisma();
  const run = await prisma.aiResourceMigrationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`Migration run not found: ${runId}`);
  if (TERMINAL_RUN_STATUSES.includes(run.status as (typeof TERMINAL_RUN_STATUSES)[number])) {
    throw new Error(`Run ${runId} is terminal (${run.status}) and cannot be resumed`);
  }

  const sourceStoragePath = resolveSourceStoragePath(sourceSqlitePath);
  const targetUploadsDir = resolveTargetUploadsDir();
  const db = openSourceDatabase(sourceSqlitePath);
  const startedAt = run.startedAt.toISOString();
  let report =
    (await readMigrationReport(runId)) ??
    ({
      runId,
      mode: 'resume',
      startedAt,
      sourceSqlitePath,
      sourceStoragePath,
      targetUploadsDir,
      sourceCounts: { users: 0, resources: 0, reviewRequests: 0, updateLogs: 0, favorites: 0 },
    } satisfies MigrationReport);

  try {
    const snapshot = readSourceSnapshot(db);
    report.sourceCounts = snapshot.counts;

    if (run.status === RUN_STATUS.STAGING) {
      const { summary } = await migrateDatabasePhase(runId, snapshot);
      report.summary = summary;
      await transitionRunStatus(runId, RUN_STATUS.STAGING, RUN_STATUS.DB_COMMITTED);
      await prisma.aiResourceMigrationRun.update({
        where: { id: runId },
        data: { reportPath: resolveReportPath(runId) },
      });
      run.status = RUN_STATUS.DB_COMMITTED;
    }

    if (run.status === RUN_STATUS.DB_COMMITTED) {
      const fileResult = await promoteAttachmentFiles(snapshot, sourceStoragePath, targetUploadsDir);
      report.fileManifest = fileResult.manifest;
      report.summary = {
        ...(report.summary ?? {
          users: { created: 0, updated: 0 },
          memberships: { created: 0, updated: 0 },
          resources: { created: 0, updated: 0 },
          reviewRequests: { created: 0, updated: 0 },
          updateLogs: { created: 0, updated: 0 },
          favorites: { created: 0, updated: 0 },
          effectiveAdmins: 0,
          filesCreated: 0,
          filesReused: 0,
        }),
        filesCreated: fileResult.created,
        filesReused: fileResult.reused,
      };
      await transitionRunStatus(runId, RUN_STATUS.DB_COMMITTED, RUN_STATUS.FILES_PROMOTED);
      run.status = RUN_STATUS.FILES_PROMOTED;
    }

    if (run.status === RUN_STATUS.FILES_PROMOTED) {
      await transitionRunStatus(runId, RUN_STATUS.FILES_PROMOTED, RUN_STATUS.COMPLETED);
    }

    report.finishedAt = new Date().toISOString();
    const reportPath = await writeMigrationReport(report);
    await prisma.aiResourceMigrationRun.update({
      where: { id: runId },
      data: { reportPath },
    });

    console.log(`\nResumed migration run ${runId}`);
    printSourceCounts(report.sourceCounts);
    if (report.summary) printSummary(report.summary);
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.finishedAt = new Date().toISOString();
    await writeMigrationReport(report).catch(() => undefined);
    throw error;
  } finally {
    db.close();
  }
}

async function runFreshMigration(sourceSqlitePath: string) {
  const prisma = getMigrationPrisma();
  const sourceStoragePath = resolveSourceStoragePath(sourceSqlitePath);
  const targetUploadsDir = resolveTargetUploadsDir();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  await ensureModuleSettingsRow();

  const db = openSourceDatabase(sourceSqlitePath);
  const report: MigrationReport = {
    runId,
    mode: 'migrate',
    startedAt,
    sourceSqlitePath,
    sourceStoragePath,
    targetUploadsDir,
    sourceCounts: { users: 0, resources: 0, reviewRequests: 0, updateLogs: 0, favorites: 0 },
  };

  await prisma.aiResourceMigrationRun.create({
    data: {
      id: runId,
      status: RUN_STATUS.STAGING,
      reportPath: resolveReportPath(runId),
    },
  });

  try {
    const snapshot = readSourceSnapshot(db);
    report.sourceCounts = snapshot.counts;
    printSourceCounts(snapshot.counts);

    const { summary } = await migrateDatabasePhase(runId, snapshot);
    report.summary = summary;
    await transitionRunStatus(runId, RUN_STATUS.STAGING, RUN_STATUS.DB_COMMITTED);

    const fileResult = await promoteAttachmentFiles(snapshot, sourceStoragePath, targetUploadsDir);
    report.fileManifest = fileResult.manifest;
    summary.filesCreated = fileResult.created;
    summary.filesReused = fileResult.reused;
    await transitionRunStatus(runId, RUN_STATUS.DB_COMMITTED, RUN_STATUS.FILES_PROMOTED);
    await transitionRunStatus(runId, RUN_STATUS.FILES_PROMOTED, RUN_STATUS.COMPLETED);

    report.finishedAt = new Date().toISOString();
    const reportPath = await writeMigrationReport(report);
    await prisma.aiResourceMigrationRun.update({
      where: { id: runId },
      data: { reportPath },
    });

    console.log(`\nMigration completed: ${runId}`);
    printSummary(summary);
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.finishedAt = new Date().toISOString();
    await writeMigrationReport(report).catch(() => undefined);

    try {
      await rollbackMigrationRun(runId);
    } catch (rollbackError) {
      await prisma.aiResourceMigrationRun.updateMany({
        where: { id: runId },
        data: {
          status: RUN_STATUS.FAILED,
          finishedAt: new Date(),
          errorMessage:
            rollbackError instanceof Error
              ? `${report.error}; rollback failed: ${rollbackError.message}`
              : `${report.error}; rollback failed`,
        },
      });
      throw rollbackError;
    }
    throw error;
  } finally {
    db.close();
  }
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const sourceSqlitePath = requireSourcePath();

  if (options.dryRun) {
    await runDryRun(sourceSqlitePath);
    await disconnectMigrationPrisma();
    return;
  }

  const lock = new MigrationAdvisoryLock(process.env.DATABASE_URL);
  await lock.acquire();
  try {
    if (options.rollbackRunId) {
      await rollbackMigrationRun(options.rollbackRunId);
      console.log(`Rollback completed for run ${options.rollbackRunId}`);
      return;
    }

    if (options.resumeRunId) {
      await resumeRun(options.resumeRunId, sourceSqlitePath);
      return;
    }

    await runFreshMigration(sourceSqlitePath);
  } finally {
    await lock.release();
    await disconnectMigrationPrisma();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migrate:ai-resources] ${message}`);
  process.exit(1);
});
