import type { Prisma } from '@/generated/prisma/client';
import type { AiResourceActor } from './guards';
import { hasAiResourceRole } from './roles';

export function canAdmin(actor: AiResourceActor) {
  return actor.isEffectiveAdmin;
}

export function canReview(actor: AiResourceActor) {
  return hasAiResourceRole(actor.moduleRole, 'reviewer');
}

/** 审批人可审他人；管理员还可自审自己的待审单。指定审批人后仅本人与管理员可审。 */
export function canActOnReviewRequest(
  actor: AiResourceActor,
  request: { status: string; requesterId: string; reviewerId?: string | null },
) {
  if (!canReview(actor) || request.status !== 'PENDING') return false;
  if (request.requesterId === actor.userId) return canAdmin(actor);
  if (request.reviewerId && request.reviewerId !== actor.userId && !canAdmin(actor)) {
    return false;
  }
  return true;
}

/** 待审批列表过滤：管理员看全部；审批人只看指派给自己的（含历史未指派单）。 */
export function pendingReviewWhere(actor: AiResourceActor) {
  if (!canReview(actor)) {
    return { status: 'PENDING' as const, requesterId: actor.userId };
  }
  if (canAdmin(actor)) {
    return { status: 'PENDING' as const };
  }
  return {
    status: 'PENDING' as const,
    requesterId: { not: actor.userId },
    OR: [{ reviewerId: actor.userId }, { reviewerId: null }],
  };
}

export function canEditResource(
  actor: AiResourceActor,
  resource: Pick<{ createdById: string }, 'createdById'>,
) {
  return canReview(actor) || resource.createdById === actor.userId;
}

/** 上传者可发起删除审批；管理员仍可走后台直接归档。 */
export function canRequestArchive(
  actor: AiResourceActor,
  resource: Pick<{ createdById: string; status: string }, 'createdById' | 'status'>,
) {
  return resource.status !== 'ARCHIVED' && resource.createdById === actor.userId;
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
