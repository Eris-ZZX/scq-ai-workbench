import fs from 'node:fs/promises';
import type { MigrationReport } from './shared';
import { resolveReportDir, resolveReportPath } from './shared';

export async function writeMigrationReport(report: MigrationReport) {
  const dir = resolveReportDir();
  await fs.mkdir(dir, { recursive: true });
  const reportPath = resolveReportPath(report.runId);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

export async function readMigrationReport(runId: string): Promise<MigrationReport | null> {
  const reportPath = resolveReportPath(runId);
  try {
    const raw = await fs.readFile(reportPath, 'utf8');
    return JSON.parse(raw) as MigrationReport;
  } catch {
    return null;
  }
}

export function printSourceCounts(counts: MigrationReport['sourceCounts']) {
  console.log('Source counts:');
  console.log(`  User:          ${counts.users}`);
  console.log(`  Resource:      ${counts.resources}`);
  console.log(`  UpdateLog:     ${counts.updateLogs}`);
  console.log(`  ReviewRequest: ${counts.reviewRequests}`);
  console.log(`  Favorite:      ${counts.favorites}`);
}

export function printSummary(summary: NonNullable<MigrationReport['summary']>) {
  console.log('Migration summary:');
  console.log(`  Users:         created=${summary.users.created} updated=${summary.users.updated}`);
  console.log(
    `  Memberships:   created=${summary.memberships.created} updated=${summary.memberships.updated}`,
  );
  console.log(
    `  Resources:     created=${summary.resources.created} updated=${summary.resources.updated}`,
  );
  console.log(
    `  Reviews:       created=${summary.reviewRequests.created} updated=${summary.reviewRequests.updated}`,
  );
  console.log(
    `  UpdateLogs:    created=${summary.updateLogs.created} updated=${summary.updateLogs.updated}`,
  );
  console.log(
    `  Favorites:     created=${summary.favorites.created} updated=${summary.favorites.updated}`,
  );
  console.log(`  Files:         created=${summary.filesCreated} reused=${summary.filesReused}`);
  console.log(`  Effective admins: ${summary.effectiveAdmins}`);
}

export function printDryRunPlan(report: MigrationReport) {
  console.log('\n=== AI Resources Migration — DRY RUN ===');
  console.log(`Source SQLite: ${report.sourceSqlitePath}`);
  console.log(`Source storage: ${report.sourceStoragePath}`);
  console.log(`Target uploads: ${report.targetUploadsDir}`);
  printSourceCounts(report.sourceCounts);
  console.log('\nNo database or filesystem writes were performed.');
}
