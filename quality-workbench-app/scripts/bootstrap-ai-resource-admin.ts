#!/usr/bin/env tsx
/**
 * Assign AiResourceMembership.admin for local testing without a full migration.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-ai-resource-admin.ts [username]
 *
 * If username is omitted, picks the first active workbench admin (User.role=admin).
 * Creating the first module admin is allowed; demoting the last effective admin is blocked.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { countEffectiveAdmins } from '@/modules/ai-resources/guards';
import { ensureModuleSettings } from '@/modules/ai-resources/maintenance';

async function resolveTargetUsername(argvUsername: string | undefined): Promise<string> {
  if (argvUsername?.trim()) return argvUsername.trim();

  const workbenchAdmin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { username: true },
  });
  if (!workbenchAdmin) {
    throw new Error('No username provided and no active workbench admin found');
  }
  return workbenchAdmin.username;
}

async function main() {
  const username = await resolveTargetUsername(process.argv[2]);
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, status: true },
  });

  if (!user) {
    throw new Error(`User not found: ${username}`);
  }
  if (user.status !== 'active') {
    throw new Error(`User is not active: ${username}`);
  }

  const beforeCount = await countEffectiveAdmins();

  const membership = await prisma.$transaction(async (tx) => {
    await ensureModuleSettings(tx);

    const existing = await tx.aiResourceMembership.findUnique({ where: { userId: user.id } });
    if (existing?.role === 'admin') {
      return existing;
    }

    if (existing) {
      return tx.aiResourceMembership.update({
        where: { userId: user.id },
        data: { role: 'admin' },
      });
    }

    return tx.aiResourceMembership.create({
      data: { userId: user.id, role: 'admin' },
    });
  });

  const afterCount = await countEffectiveAdmins();
  console.log(`Assigned AI resource admin to ${user.username}`);
  console.log(`Membership id: ${membership.id}`);
  console.log(`Effective admins: ${beforeCount} -> ${afterCount}`);
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[bootstrap-ai-resource-admin] ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
