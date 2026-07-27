import type { Prisma } from '@/generated/prisma/client';
import type { AiResourceActor } from './guards';
import { hasAiResourceRole } from './roles';

export function canAdmin(actor: AiResourceActor) {
  return actor.isEffectiveAdmin;
}

export function canReview(actor: AiResourceActor) {
  return hasAiResourceRole(actor.moduleRole, 'reviewer');
}

export function canEditResource(
  actor: AiResourceActor,
  resource: Pick<{ createdById: string }, 'createdById'>,
) {
  return canReview(actor) || resource.createdById === actor.userId;
}

/** Current version: all members visible; no dept/user filtering. */
export function visibleResourceWhere(_actor: AiResourceActor): Prisma.AiResourceWhereInput {
  return {};
}

export function canViewResource(
  _actor: AiResourceActor,
  _resource: Pick<
    { visibilityScope: string; visibleDeptIds: string; visibleUserIds: string; createdById: string },
    'visibilityScope' | 'visibleDeptIds' | 'visibleUserIds' | 'createdById'
  >,
) {
  return true;
}

export function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
