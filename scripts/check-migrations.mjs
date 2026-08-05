import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_DIR = resolve(SCRIPT_DIR, '..', 'drizzle');
export const DESTRUCTIVE_OVERRIDE = 'QE_ALLOW_DESTRUCTIVE_MIGRATIONS';

const HARD_RULES = [
  {
    code: 'drop-table',
    pattern: /\bDROP\s+TABLE\b/gi,
    message: '删除数据表',
  },
  {
    code: 'drop-column',
    pattern: /\bDROP\s+COLUMN\b/gi,
    message: '删除数据列',
  },
  {
    code: 'drop-constraint',
    pattern: /\bDROP\s+CONSTRAINT\b/gi,
    message: '删除约束',
  },
  {
    code: 'drop-schema-or-type',
    pattern: /\bDROP\s+(?:SCHEMA|TYPE)\b/gi,
    message: '删除 schema 或数据库类型',
  },
  {
    code: 'truncate',
    pattern: /\bTRUNCATE(?:\s+TABLE)?\b/gi,
    message: '清空数据表',
  },
  {
    code: 'alter-column-type',
    pattern: /\bALTER\s+TABLE\b[^;]*?\bALTER\s+COLUMN\b[^;]*?\bTYPE\b/gi,
    message: '修改列类型，可能导致数据截断或转换失败',
  },
];

const REVIEW_RULES = [
  {
    code: 'set-not-null',
    pattern: /\bALTER\s+TABLE\b[^;]*?\bALTER\s+COLUMN\b[^;]*?\bSET\s+NOT\s+NULL\b/gi,
    message: '设置强制非空，需确认历史数据已完成回填',
    requiresBackfill: true,
  },
  {
    code: 'delete-from',
    pattern: /\bDELETE\s+FROM\b/gi,
    message: '删除数据行，需确认 WHERE 条件和回滚策略',
  },
  {
    code: 'drop-index',
    pattern: /\bDROP\s+INDEX\b/gi,
    message: '删除索引，需确认查询性能和唯一性约束不受影响',
  },
];

function stripSqlComments(source) {
  return source
    .replace(/--[^\n]*/g, (comment) => ' '.repeat(comment.length))
    .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, ' '),
    );
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function collectFindings(source, file, rules, severity) {
  const findings = [];
  const uncommented = stripSqlComments(source);

  for (const rule of rules) {
    const flags = rule.pattern.flags.includes('g')
      ? rule.pattern.flags
      : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);
    for (const match of uncommented.matchAll(pattern)) {
      const offset = match.index ?? 0;
      const hasBackfill = rule.requiresBackfill
        ? /\bUPDATE\s+[\s\S]*\bSET\b/i.test(uncommented.slice(0, offset))
        : true;
      findings.push({
        file,
        line: lineNumberAt(source, offset),
        code: rule.code,
        message: rule.message,
        severity: rule.requiresBackfill && !hasBackfill ? 'block' : severity,
      });
    }
  }

  return findings;
}

export function analyzeMigrationContent(source, file = 'migration.sql') {
  const findings = [
    ...collectFindings(source, file, HARD_RULES, 'block'),
    ...collectFindings(source, file, REVIEW_RULES, 'review'),
  ].sort((left, right) => left.line - right.line || left.code.localeCompare(right.code));

  return {
    findings,
    blocked: findings.filter((finding) => finding.severity === 'block'),
    review: findings.filter((finding) => finding.severity === 'review'),
  };
}

export async function checkMigrationDirectory(directory = DEFAULT_MIGRATIONS_DIR) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  const results = [];
  for (const file of files) {
    const path = join(directory, file);
    const source = await readFile(path, 'utf8');
    results.push(analyzeMigrationContent(source, file));
  }
  return { files, results };
}

function formatFinding(finding) {
  return `${finding.file}:${finding.line} ${finding.message} [${finding.code}]`;
}

export async function main() {
  const { files, results } = await checkMigrationDirectory();
  const findings = results.flatMap((result) => result.findings);
  const blocked = findings.filter((finding) => finding.severity === 'block');
  const review = findings.filter((finding) => finding.severity === 'review');
  const override = process.env[DESTRUCTIVE_OVERRIDE] === '1';

  for (const finding of review) {
    console.warn(`[migration-check] review: ${formatFinding(finding)}`);
  }

  if (blocked.length > 0) {
    const prefix = override
      ? `[migration-check] ${DESTRUCTIVE_OVERRIDE}=1 已显式放行破坏性迁移`
      : '[migration-check] 检测到未确认的破坏性迁移';
    console.warn(prefix);
    for (const finding of blocked) {
      console.warn(`  - ${formatFinding(finding)}`);
    }
    if (!override) {
      throw new Error(
        `迁移预检失败:发现 ${blocked.length} 条破坏性变更；如已完成人工审查，请设置 ${DESTRUCTIVE_OVERRIDE}=1 后重试`,
      );
    }
  }

  console.info(
    `[migration-check] 已检查 ${files.length} 个 migration 文件，` +
      `发现 ${blocked.length} 条破坏性变更、${review.length} 条需人工复核项`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`[migration-check] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
