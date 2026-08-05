import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { closeDatabase } from '@/db/client';
import { db } from '@/lib/database';
import {
  buildIdentityMigrationPlan,
  type AuthingManifestEntry,
  type LegacyDirectoryUser,
} from '@/platform/auth/identity-migration';

type LocalUserRow = LegacyDirectoryUser & {
  display_name: string | null;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadManifest(path: string) {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { users?: unknown }).users)
      ? (parsed as { users: unknown[] }).users
      : null;
  if (!entries) throw new Error('Authing manifest 必须是数组或 { users: [] }');
  return entries.filter((entry): entry is AuthingManifestEntry => (
    Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as AuthingManifestEntry).subject === 'string'
  ));
}

async function applyLinks(
  decisions: ReturnType<typeof buildIdentityMigrationPlan>,
  defaultIssuer: string,
) {
  let applied = 0;
  let conflicts = 0;
  await db.$transaction(async (transaction) => {
    for (const decision of decisions) {
      if (decision.kind !== 'link') continue;
      const issuer = (decision.entry.issuer?.trim() || defaultIssuer).replace(/\/+$/, '');
      const existingForUser = await transaction.$queryRaw<{ subject: string }[]>`
        SELECT subject
        FROM user_identities
        WHERE provider = 'authing'
          AND issuer = ${issuer}
          AND user_id = ${decision.user.id}
          AND subject <> ${decision.entry.subject}
        LIMIT 1
      `;
      if (existingForUser[0]) {
        conflicts += 1;
        continue;
      }

      const existingSubject = await transaction.$queryRaw<{ user_id: string }[]>`
        SELECT user_id
        FROM user_identities
        WHERE provider = 'authing'
          AND issuer = ${issuer}
          AND subject = ${decision.entry.subject}
        LIMIT 1
      `;
      if (existingSubject[0] && existingSubject[0].user_id !== decision.user.id) {
        conflicts += 1;
        continue;
      }

      await transaction.$queryRaw`
        INSERT INTO user_identities (
          id, user_id, provider, issuer, subject, username, display_name,
          email, avatar, last_sync_at, created_at, updated_at
        )
        VALUES (
          ${randomUUID()}, ${decision.user.id}, 'authing', ${issuer},
          ${decision.entry.subject}, ${decision.entry.username ?? decision.user.username},
          ${decision.entry.name}, ${decision.entry.email}, ${decision.entry.avatar},
          now(), now(), now()
        )
        ON CONFLICT (provider, issuer, subject)
        DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          avatar = EXCLUDED.avatar,
          last_sync_at = now(),
          updated_at = now()
      `;
      await transaction.$queryRaw`
        UPDATE users
        SET display_name = COALESCE(display_name, ${decision.entry.name}),
            external_source = 'authing',
            external_id = ${`${issuer}:${decision.entry.subject}`}
        WHERE id = ${decision.user.id}
      `;
      applied += 1;
    }
  });
  return { applied, conflicts };
}

async function main() {
  const manifestPath = argument('--manifest');
  const issuer = process.env.AUTHING_ISSUER?.trim();
  if (!manifestPath) throw new Error('请提供 --manifest <Authing 用户导出 JSON>');
  if (!issuer) throw new Error('AUTHING_ISSUER is required');

  const entries = await loadManifest(manifestPath);
  const users = await db.$queryRaw<LocalUserRow[]>`
    SELECT id, username, email, status, display_name
    FROM users
    WHERE external_source = 'dingtalk'
  `;
  const decisions = buildIdentityMigrationPlan(users, entries);
  const summary = {
    total: decisions.length,
    links: decisions.filter((decision) => decision.kind === 'link').length,
    ambiguous: decisions.filter((decision) => decision.kind === 'ambiguous').length,
    unmatched: decisions.filter((decision) => decision.kind === 'unmatched').length,
    applied: 0,
    conflicts: 0,
    dryRun: !process.argv.includes('--apply'),
  };

  if (process.argv.includes('--apply')) {
    const applied = await applyLinks(decisions, issuer);
    summary.applied = applied.applied;
    summary.conflicts = applied.conflicts;
  }

  console.log(JSON.stringify({
    summary,
    decisions: decisions.map((decision) => (
      decision.kind === 'link'
        ? {
          kind: decision.kind,
          subject: decision.entry.subject,
          username: decision.entry.username ?? null,
          userId: decision.user.id,
          matchedBy: decision.matchedBy,
          status: decision.user.status,
        }
        : {
          kind: decision.kind,
          subject: decision.entry.subject,
          username: decision.entry.username ?? null,
          candidateUserIds: decision.kind === 'ambiguous'
            ? decision.candidates.map((candidate) => candidate.id)
            : [],
        }
    )),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
