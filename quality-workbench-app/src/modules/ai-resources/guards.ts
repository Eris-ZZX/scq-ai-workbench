import { redirect } from 'next/navigation';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';
import { AiResourceError } from './errors';
import { isAiResourcesEnabled, supportsAiResourceRowLocks } from './config';
import {
  hasAiResourceRole,
  isAiResourceRole,
  type AiResourceRole,
} from './roles';

export type AiResourceActor = {
  userId: string;
  username: string;
  workbenchRole: string;
  moduleRole: AiResourceRole;
  membershipId: string | null;
  isEffectiveAdmin: boolean;
};

type Tx = Prisma.TransactionClient;

async function loadActor(userId: string, username: string, workbenchRole: string): Promise<AiResourceActor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      status: true,
      aiResourceMembership: { select: { id: true, role: true } },
    },
  });

  if (!user || user.status !== 'active') {
    throw new AiResourceError('账号不可用', 401, 'INACTIVE');
  }

  const rawRole = user.aiResourceMembership?.role ?? 'user';
  const moduleRole: AiResourceRole = isAiResourceRole(rawRole) ? rawRole : 'user';
  const isEffectiveAdmin = moduleRole === 'admin';

  return {
    userId: user.id,
    username: user.username || username,
    workbenchRole,
    moduleRole,
    membershipId: user.aiResourceMembership?.id ?? null,
    isEffectiveAdmin,
  };
}

/** Page/layout guard: redirect to login / portal when unavailable. */
export async function requireAiResourceUser(): Promise<AiResourceActor> {
  if (!isAiResourcesEnabled()) {
    redirect('/portal');
  }

  const session = await getSession();
  if (!session) redirect('/login');

  try {
    return await loadActor(session.sub, session.username, session.role);
  } catch (error) {
    if (error instanceof AiResourceError && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }
}

export async function requireAiResourceRole(minimum: AiResourceRole): Promise<AiResourceActor> {
  const actor = await requireAiResourceUser();
  if (!hasAiResourceRole(actor.moduleRole, minimum)) {
    throw new AiResourceError('权限不足', 403, 'FORBIDDEN');
  }
  return actor;
}

/** API guard: throws AiResourceError instead of redirecting. */
export async function requireAiResourceUserApi(): Promise<AiResourceActor> {
  if (!isAiResourcesEnabled()) {
    throw new AiResourceError('AI 资源库未启用', 503, 'DISABLED');
  }

  const session = await getSession();
  if (!session) {
    throw new AiResourceError('未登录', 401, 'UNAUTHORIZED');
  }

  return loadActor(session.sub, session.username, session.role);
}

export async function requireAiResourceRoleApi(minimum: AiResourceRole): Promise<AiResourceActor> {
  const actor = await requireAiResourceUserApi();
  if (!hasAiResourceRole(actor.moduleRole, minimum)) {
    throw new AiResourceError('权限不足', 403, 'FORBIDDEN');
  }
  return actor;
}

/**
 * Count effective admins (active user ∧ membership.admin) with optional row lock.
 * Use inside SERIALIZABLE / FOR UPDATE flows before demoting the last admin.
 */
export async function countEffectiveAdmins(tx: Tx = prisma, lockRows = false) {
  if (lockRows && supportsAiResourceRowLocks()) {
    await tx.$queryRaw`
      SELECT m.id FROM "AiResourceMembership" m
      INNER JOIN "User" u ON u.id = m."userId"
      WHERE m.role = 'admin' AND u.status = 'active'
      FOR UPDATE
    `;
  }

  return tx.aiResourceMembership.count({
    where: {
      role: 'admin',
      user: { status: 'active' },
    },
  });
}

/**
 * Prevent removing / demoting the last effective module admin.
 * Call inside the same transaction that mutates membership, after locking rows.
 */
export async function assertNotLastEffectiveAdmin(
  tx: Tx,
  subjectUserId: string,
  nextRole: AiResourceRole | null,
) {
  const subject = await tx.aiResourceMembership.findUnique({
    where: { userId: subjectUserId },
    include: { user: { select: { status: true } } },
  });

  const wasEffectiveAdmin =
    subject?.role === 'admin' && subject.user.status === 'active';
  if (!wasEffectiveAdmin) return;

  const stillAdmin = nextRole === 'admin';
  if (stillAdmin) return;

  const remaining = await countEffectiveAdmins(tx);
  // subject still counted in remaining; after demotion/delete one fewer
  if (remaining <= 1) {
    throw new AiResourceError('不能移除末位有效模块管理员', 409, 'LAST_ADMIN');
  }
}
