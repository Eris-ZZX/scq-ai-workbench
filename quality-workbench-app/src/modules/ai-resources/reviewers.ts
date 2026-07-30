import { prisma } from '@/lib/prisma';
import { AiResourceError } from './errors';
import type { AiResourceActor } from './guards';

export type ReviewerOption = {
  id: string;
  username: string;
  role: string;
};

/** Active module reviewers/admins available for assignment. */
export async function listAssignableReviewers(excludeUserId?: string) {
  const memberships = await prisma.aiResourceMembership.findMany({
    where: {
      role: { in: ['reviewer', 'admin'] },
      user: { status: 'active' },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: {
      role: true,
      user: { select: { id: true, username: true } },
    },
    orderBy: { user: { username: 'asc' } },
  });

  return memberships.map((item) => ({
    id: item.user.id,
    username: item.user.username,
    role: item.role,
  })) satisfies ReviewerOption[];
}

/** Ensure the chosen reviewer can receive the request. */
export async function assertAssignableReviewer(
  actor: AiResourceActor,
  reviewerId: string,
) {
  if (reviewerId === actor.userId && !actor.isEffectiveAdmin) {
    throw new AiResourceError('不能将审批单指定给自己。', 400, 'INVALID_REVIEWER');
  }

  const membership = await prisma.aiResourceMembership.findFirst({
    where: {
      userId: reviewerId,
      role: { in: ['reviewer', 'admin'] },
      user: { status: 'active' },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AiResourceError('请选择有效的审批人。', 400, 'INVALID_REVIEWER');
  }
}
