// lib/db/activities.ts — F2 新产品导入活动跟踪
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const PARENT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PENDING_NPQ_CLOSE: 'pending_npq_close',
  CLOSED: 'closed',
} as const;

export const CHILD_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  RETURNED: 'returned',
  COMPLETED: 'completed',
} as const;

type ParentStatus = (typeof PARENT_STATUS)[keyof typeof PARENT_STATUS];
type ActivityTx = typeof prisma | Prisma.TransactionClient;

const VALID_CHILD_STATUSES = new Set<string>(Object.values(CHILD_STATUS));

type ActivityTemplateLike = {
  stage: string;
  projectTaskName: string;
  thirdLevelPlan: string;
  ownerRole: string;
  roleGroup: string;
  deliverableName: string | null;
  requiresDeliverable: boolean;
  sortOrder: number;
};

export function getRoleGroup(ownerRole: string) {
  const trimmed = ownerRole.trim();
  const [prefix] = trimmed.split('-', 1);
  return prefix || trimmed;
}

export async function canAccessProject(projectId: string, userId: string, appRole?: string) {
  if (appRole === 'admin') return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });
  return Boolean(member);
}

export async function isProjectOwnerOrAdmin(projectId: string, userId: string, appRole?: string) {
  if (appRole === 'admin') return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId, role: 'owner' },
    select: { id: true },
  });
  return Boolean(member);
}

export async function ensureProjectActivities(projectId: string, actorUserId?: string, templateSetId?: string) {
  const existing = await prisma.projectActivityParent.count({ where: { projectId } });
  if (existing > 0) return { created: false, parentCount: existing, childCount: 0 };

  const structuredResult = await ensureStructuredProjectActivities(projectId, actorUserId, templateSetId);
  if (structuredResult.created || structuredResult.parentCount > 0) return structuredResult;

  const templates = await prisma.activityTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }],
  });

  if (templates.length === 0) {
    return { created: false, parentCount: 0, childCount: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const parentByKey = new Map<string, { id: string; sortOrder: number }>();
    let parentIndex = 0;
    let childCount = 0;

    for (const template of templates as ActivityTemplateLike[]) {
      const key = `${template.stage}::${template.projectTaskName}`;
      let parent = parentByKey.get(key);
      if (!parent) {
        parentIndex += 1;
        const createdParent = await tx.projectActivityParent.create({
          data: {
            projectId,
            stage: template.stage,
            projectTaskName: template.projectTaskName,
            plannedDueDate: defaultDueDate(template.stage),
            sortOrder: parentIndex,
          },
          select: { id: true, sortOrder: true },
        });
        parent = createdParent;
        parentByKey.set(key, parent);
      }

      await tx.projectActivityChild.create({
        data: {
          projectId,
          parentId: parent.id,
          thirdLevelPlan: template.thirdLevelPlan,
          ownerRole: template.ownerRole,
          roleGroup: template.roleGroup || getRoleGroup(template.ownerRole),
          requiresDeliverable: template.requiresDeliverable,
          requiresAttachment: template.requiresDeliverable,
          requiresNote: !template.requiresDeliverable,
          deliverableName: template.deliverableName,
          sortOrder: template.sortOrder,
        },
      });
      childCount += 1;
    }

    await tx.activityEvent.create({
      data: {
        projectId,
        actorUserId,
        actorRole: 'NPQ',
        actionType: 'initialize_project_activities',
        afterValue: JSON.stringify({ parentCount: parentByKey.size, childCount }),
        note: '创建项目时按活动模板库生成全阶段活动实例',
      },
    });

    return { created: true, parentCount: parentByKey.size, childCount };
  });
}

async function ensureStructuredProjectActivities(projectId: string, actorUserId?: string, templateSetId?: string) {
  return prisma.$transaction(async (tx) => {
    const templateSet = await tx.activityTemplateSet.findFirst({
      where: templateSetId
        ? { id: templateSetId, latestPublishedVersionId: { not: null } }
        : { isActive: true, latestPublishedVersionId: { not: null } },
      include: {
        latestPublishedVersion: {
          include: {
            stages: {
              orderBy: { sortOrder: 'asc' },
              include: {
                parents: {
                  orderBy: { sortOrder: 'asc' },
                  include: { children: { orderBy: { sortOrder: 'asc' } } },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const version = templateSet?.latestPublishedVersion;
    if (!templateSet || !version) return { created: false, parentCount: 0, childCount: 0 };

    const assignments = await tx.projectPositionAssignment.findMany({
      where: { projectId },
      select: { positionRoleId: true, userId: true },
    });
    const userByPosition = new Map(assignments.map((assignment) => [assignment.positionRoleId, assignment.userId]));

    let parentCount = 0;
    let childCount = 0;
    for (const stage of version.stages) {
      await tx.stageGateRecord.upsert({
        where: { projectId_stage: { projectId, stage: stage.code } },
        create: { projectId, stage: stage.code },
        update: {},
      });

      for (const parent of stage.parents) {
        parentCount += 1;
        const createdParent = await tx.projectActivityParent.create({
          data: {
            projectId,
            templateParentId: parent.id,
            stage: stage.code,
            projectTaskName: parent.name,
            plannedDueDate: parent.plannedOffsetDays ? offsetDueDate(parent.plannedOffsetDays) : defaultDueDate(stage.code),
            sortOrder: parent.sortOrder || parentCount,
          },
          select: { id: true },
        });

        for (const child of parent.children) {
          childCount += 1;
          const assigneeUserId = child.responsibleRoleId ? userByPosition.get(child.responsibleRoleId) : undefined;
          await tx.projectActivityChild.create({
            data: {
              projectId,
              parentId: createdParent.id,
              templateChildId: child.id,
              thirdLevelPlan: child.title,
              ownerRole: child.ownerRoleName,
              roleGroup: child.roleGroup,
              responsibleRoleId: child.responsibleRoleId,
              assigneeUserId,
              requiresDeliverable: child.requiresDeliverable,
              requiresAttachment: child.requiresAttachment,
              requiresNote: child.requiresNote,
              deliverableName: child.deliverableName,
              sortOrder: child.sortOrder || childCount,
            },
          });
        }
      }
    }

    await tx.projectActivitySnapshotMeta.upsert({
      where: { projectId },
      create: {
        projectId,
        templateSetId: templateSet.id,
        templateVersionId: version.id,
        generatedById: actorUserId,
      },
      update: {
        templateSetId: templateSet.id,
        templateVersionId: version.id,
        generatedById: actorUserId,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        actorUserId,
        actorRole: 'NPQ',
        actionType: 'initialize_project_activity_snapshot',
        afterValue: JSON.stringify({ templateSetId: templateSet.id, templateVersionId: version.id, parentCount, childCount }),
        note: '项目创建时按最新发布活动模板生成快照',
      },
    });

    return { created: true, parentCount, childCount };
  });
}

function defaultDueDate(stage: string) {
  const offset: Record<string, number> = {
    TR1: 14,
    'TR2&3': 30,
    TR4: 45,
    TR4A: 60,
    TR5: 75,
    TR6: 90,
  };
  const date = new Date();
  date.setDate(date.getDate() + (offset[stage] ?? 30));
  return date;
}

function offsetDueDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function getProjectActivityView(projectId: string) {
  await ensureProjectActivities(projectId);
  return prisma.projectActivityParent.findMany({
    where: { projectId },
    include: {
      children: {
        include: { attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } },
        orderBy: [{ sortOrder: 'asc' }],
      },
    },
    orderBy: [{ sortOrder: 'asc' }],
  });
}

export async function getActivityEvents(projectId: string, childId?: string) {
  return prisma.activityEvent.findMany({
    where: { projectId, ...(childId ? { childId } : {}) },
    include: { actor: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function updateActivityParent(params: {
  parentId: string;
  actorUserId: string;
  plannedDueDate?: string | null;
  close?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.projectActivityParent.findUnique({
      where: { id: params.parentId },
      include: { children: true },
    });
    if (!parent) throw new Error('PARENT_NOT_FOUND');

    const before = {
      status: parent.status,
      plannedDueDate: parent.plannedDueDate,
      closedAt: parent.closedAt,
    };

    const updateData: Record<string, unknown> = {};
    if ('plannedDueDate' in params) {
      updateData.plannedDueDate = params.plannedDueDate ? new Date(params.plannedDueDate) : null;
    }

    if (params.close) {
      const allCompleted = parent.children.every((child) => child.status === CHILD_STATUS.COMPLETED);
      if (!allCompleted) throw new Error('PARENT_CHILDREN_NOT_COMPLETED');
      updateData.status = PARENT_STATUS.CLOSED;
      updateData.closedAt = new Date();
      updateData.closedById = params.actorUserId;
    }

    const updated = await tx.projectActivityParent.update({
      where: { id: params.parentId },
      data: updateData,
      include: { children: { orderBy: { sortOrder: 'asc' } } },
    });

    await tx.activityEvent.create({
      data: {
        projectId: parent.projectId,
        parentId: parent.id,
        actorUserId: params.actorUserId,
        actorRole: 'NPQ',
        actionType: params.close ? 'close_parent' : 'update_parent_plan',
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify({
          status: updated.status,
          plannedDueDate: updated.plannedDueDate,
          closedAt: updated.closedAt,
        }),
      },
    });

    return updated;
  });
}

export async function updateActivityChild(params: {
  childId: string;
  actorUserId: string;
  actorRole?: string;
  status?: string;
  deliverableUrl?: string | null;
  completionNote?: string | null;
  blockerNote?: string | null;
  isBlocked?: boolean;
  plannedDueDateOverride?: string | null;
  returnReason?: string | null;
  isNotApplicable?: boolean;
  notApplicableReason?: string | null;
  assigneeUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const child = await tx.projectActivityChild.findUnique({
      where: { id: params.childId },
      include: { parent: true },
    });
    if (!child) throw new Error('CHILD_NOT_FOUND');

    const updateData: Record<string, unknown> = {};
    if ('deliverableUrl' in params) updateData.deliverableUrl = params.deliverableUrl?.trim() || null;
    if ('completionNote' in params) updateData.completionNote = params.completionNote?.trim() || null;
    if ('blockerNote' in params) updateData.blockerNote = params.blockerNote?.trim() || null;
    if ('isBlocked' in params) updateData.isBlocked = Boolean(params.isBlocked);
    if ('isNotApplicable' in params) {
      updateData.isNotApplicable = Boolean(params.isNotApplicable);
      updateData.notApplicableReason = params.notApplicableReason?.trim() || null;
      if (params.isNotApplicable) {
        updateData.status = CHILD_STATUS.NOT_STARTED;
        updateData.completedAt = null;
        updateData.isBlocked = false;
      }
    }
    if ('assigneeUserId' in params) updateData.assigneeUserId = params.assigneeUserId || null;
    if ('plannedDueDateOverride' in params) {
      updateData.plannedDueDateOverride = params.plannedDueDateOverride ? new Date(params.plannedDueDateOverride) : null;
    }

    if (params.status && !params.isNotApplicable) {
      if (!VALID_CHILD_STATUSES.has(params.status)) throw new Error('INVALID_CHILD_STATUS');
      updateData.status = params.status;
      if (params.status === CHILD_STATUS.COMPLETED) {
        validateSubmission(child.requiresDeliverable, {
          deliverableUrl: (updateData.deliverableUrl as string | null | undefined) ?? child.deliverableUrl,
          completionNote: (updateData.completionNote as string | null | undefined) ?? child.completionNote,
        });
      }
      updateData.completedAt = params.status === CHILD_STATUS.COMPLETED ? new Date() : null;
    }

    if (params.returnReason?.trim()) {
      updateData.status = CHILD_STATUS.RETURNED;
      updateData.completedAt = null;
      updateData.returnedAt = new Date();
      updateData.returnedById = params.actorUserId;
      updateData.returnReason = params.returnReason.trim();
    }

    const before = {
      status: child.status,
      deliverableUrl: child.deliverableUrl,
      completionNote: child.completionNote,
      blockerNote: child.blockerNote,
      isBlocked: child.isBlocked,
      isNotApplicable: child.isNotApplicable,
      plannedDueDateOverride: child.plannedDueDateOverride,
    };

    const updated = await tx.projectActivityChild.update({
      where: { id: child.id },
      data: updateData,
    });

    await tx.activityEvent.create({
      data: {
        projectId: child.projectId,
        parentId: child.parentId,
        childId: child.id,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole ?? child.ownerRole,
        actionType: params.returnReason?.trim() ? 'return_child' : 'update_child',
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify({
          status: updated.status,
          deliverableUrl: updated.deliverableUrl,
          completionNote: updated.completionNote,
          blockerNote: updated.blockerNote,
          isBlocked: updated.isBlocked,
          isNotApplicable: updated.isNotApplicable,
          plannedDueDateOverride: updated.plannedDueDateOverride,
        }),
        note: params.returnReason?.trim() || null,
      },
    });

    if (params.returnReason?.trim()) {
      const recipientUserId = updated.assigneeUserId ?? (
        updated.responsibleRoleId
          ? (await tx.projectPositionAssignment.findUnique({
              where: { projectId_positionRoleId: { projectId: updated.projectId, positionRoleId: updated.responsibleRoleId } },
              select: { userId: true },
            }))?.userId
          : null
      );
      if (recipientUserId) {
        await tx.notification.create({
          data: {
            recipientUserId,
            projectId: updated.projectId,
            childId: updated.id,
            type: 'child_returned',
            title: '子任务被退回',
            body: params.returnReason.trim(),
            createdById: params.actorUserId,
          },
        });
      }
    }

    await refreshParentSummary(tx, child.parentId);
    return tx.projectActivityChild.findUnique({
      where: { id: child.id },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  });
}

function validateSubmission(
  requiresDeliverable: boolean,
  values: { deliverableUrl?: string | null; completionNote?: string | null },
) {
  if (requiresDeliverable && !values.deliverableUrl?.trim()) {
    throw new Error('DELIVERABLE_REQUIRED');
  }
  if (!requiresDeliverable && !values.completionNote?.trim()) {
    throw new Error('COMPLETION_NOTE_REQUIRED');
  }
}

export async function refreshParentSummary(tx: ActivityTx, parentId: string) {
  const parent = await tx.projectActivityParent.findUnique({
    where: { id: parentId },
    include: { children: true },
  });
  if (!parent) return;

  const now = new Date();
  const involvedChildren = parent.children.filter((child) => !child.isNotApplicable);
  const total = involvedChildren.length;
  const completed = involvedChildren.filter((child) => child.status === CHILD_STATUS.COMPLETED).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasBlocked = involvedChildren.some((child) => child.isBlocked);
  const hasOverdue = involvedChildren.some((child) => {
    if (child.status === CHILD_STATUS.COMPLETED) return false;
    const due = child.plannedDueDateOverride ?? parent.plannedDueDate;
    return Boolean(due && due < now);
  });

  let status: ParentStatus = PARENT_STATUS.NOT_STARTED;
  if (parent.status === PARENT_STATUS.CLOSED) {
    status = PARENT_STATUS.CLOSED;
  } else if (total > 0 && completed === total) {
    status = PARENT_STATUS.PENDING_NPQ_CLOSE;
  } else if (involvedChildren.some((child) => child.status !== CHILD_STATUS.NOT_STARTED)) {
    status = PARENT_STATUS.IN_PROGRESS;
  }

  await tx.projectActivityParent.update({
    where: { id: parentId },
    data: { progressPercent, hasBlocked, hasOverdue, status },
  });
}

export async function getActivityDashboard(projectId?: string) {
  if (projectId) await ensureProjectActivities(projectId);

  const where = projectId ? { projectId } : {};
  const parents = await prisma.projectActivityParent.findMany({
    where,
    include: { children: true },
  });

  const totalParents = parents.length;
  const closedParents = parents.filter((parent) => parent.status === PARENT_STATUS.CLOSED).length;
  const pendingClose = parents.filter((parent) => parent.status === PARENT_STATUS.PENDING_NPQ_CLOSE).length;
  const overdueParents = parents.filter((parent) => parent.hasOverdue).length;
  const blockedParents = parents.filter((parent) => parent.hasBlocked).length;
  const parentCompletionRate = totalParents > 0 ? Math.round((closedParents / totalParents) * 100) : 0;

  const stageMap = new Map<string, { total: number; closed: number }>();
  const roleMap = new Map<string, { roleGroup: string; due: number; onTime: number; details: Map<string, { due: number; onTime: number }> }>();
  const now = new Date();

  for (const parent of parents) {
    const stage = stageMap.get(parent.stage) ?? { total: 0, closed: 0 };
    stage.total += 1;
    if (parent.status === PARENT_STATUS.CLOSED) stage.closed += 1;
    stageMap.set(parent.stage, stage);

    for (const child of parent.children) {
      if (child.isNotApplicable) continue;
      const group = child.roleGroup || getRoleGroup(child.ownerRole);
      const role = roleMap.get(group) ?? { roleGroup: group, due: 0, onTime: 0, details: new Map() };
      const detail = role.details.get(child.ownerRole) ?? { due: 0, onTime: 0 };
      role.details.set(child.ownerRole, detail);
      roleMap.set(group, role);

      const due = child.plannedDueDateOverride ?? parent.plannedDueDate;
      const shouldCount = child.status === CHILD_STATUS.COMPLETED || Boolean(due && due <= now);
      if (!shouldCount) continue;

      const onTime = child.status === CHILD_STATUS.COMPLETED && child.completedAt && due && child.completedAt <= due;
      role.due += 1;
      detail.due += 1;
      if (onTime) {
        role.onTime += 1;
        detail.onTime += 1;
      }
    }
  }

  return {
    parentCompletionRate,
    pendingClose,
    overdueParents,
    blockedParents,
    totalParents,
    closedParents,
    stageCompletion: Array.from(stageMap.entries()).map(([stage, value]) => ({
      stage,
      total: value.total,
      closed: value.closed,
      rate: value.total > 0 ? Math.round((value.closed / value.total) * 100) : 0,
    })),
    roleOnTime: Array.from(roleMap.values()).map((role) => ({
      roleGroup: role.roleGroup,
      due: role.due,
      onTime: role.onTime,
      rate: role.due > 0 ? Math.round((role.onTime / role.due) * 100) : 0,
      details: Array.from(role.details.entries()).map(([ownerRole, value]) => ({
        ownerRole,
        due: value.due,
        onTime: value.onTime,
        rate: value.due > 0 ? Math.round((value.onTime / value.due) * 100) : 0,
      })),
    })),
  };
}
