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
            plannedStartDate: defaultStartDate(template.stage),
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

    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { currentStage: true },
    });
    if (project?.currentStage) {
      await activateProjectStageActivities(projectId, project.currentStage, actorUserId, tx);
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

    let parentCount = 0;
    let childCount = 0;
    for (const stage of version.stages) {
      const stageName = stage.name;
      const stageStartDate = stage.plannedStartOffsetDays != null
        ? offsetDate(stage.plannedStartOffsetDays)
        : defaultStartDate(stageName);
      const stageDueDate = stage.plannedDueOffsetDays != null
        ? offsetDate(stage.plannedDueOffsetDays)
        : defaultDueDate(stageName);
      await tx.stageGateRecord.upsert({
        where: { projectId_stage: { projectId, stage: stageName } },
        create: {
          projectId,
          stage: stageName,
          plannedStartDate: stageStartDate,
          plannedDueDate: stageDueDate,
        },
        update: {},
      });

      for (const parent of stage.parents) {
        parentCount += 1;
        const createdParent = await tx.projectActivityParent.create({
          data: {
            projectId,
            templateParentId: parent.id,
            stage: stageName,
            projectTaskName: parent.name,
            plannedStartDate: parent.plannedStartOffsetDays != null
              ? offsetDate(parent.plannedStartOffsetDays)
              : stageStartDate,
            plannedDueDate: parent.plannedOffsetDays != null ? offsetDate(parent.plannedOffsetDays) : stageDueDate,
            sortOrder: parent.sortOrder || parentCount,
          },
          select: { id: true },
        });

        for (const child of parent.children) {
          childCount += 1;
          await tx.projectActivityChild.create({
            data: {
              projectId,
              parentId: createdParent.id,
              templateChildId: child.id,
              thirdLevelPlan: child.title,
              ownerRole: child.ownerRoleName,
              roleGroup: child.roleGroup,
              responsibleRoleId: child.responsibleRoleId,
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

    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { currentStage: true },
    });
    if (project?.currentStage) {
      await activateProjectStageActivities(projectId, project.currentStage, actorUserId, tx);
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

export async function activateProjectStageActivities(
  projectId: string,
  stage: string,
  actorUserId?: string | null,
  tx: ActivityTx = prisma,
) {
  const parentResult = await tx.projectActivityParent.updateMany({
    where: {
      projectId,
      stage,
      status: PARENT_STATUS.NOT_STARTED,
    },
    data: { status: PARENT_STATUS.IN_PROGRESS },
  });
  const childResult = await tx.projectActivityChild.updateMany({
    where: {
      projectId,
      status: CHILD_STATUS.NOT_STARTED,
      isNotApplicable: false,
      parent: { stage },
    },
    data: { status: CHILD_STATUS.IN_PROGRESS },
  });

  if (parentResult.count > 0 || childResult.count > 0) {
    await tx.activityEvent.create({
      data: {
        projectId,
        actorUserId: actorUserId ?? null,
        actorRole: actorUserId ? 'NPQ' : null,
        actionType: 'activate_stage_activities',
        afterValue: JSON.stringify({
          stage,
          activatedParentCount: parentResult.count,
          activatedChildCount: childResult.count,
        }),
        note: `进入 ${stage} 阶段，项目活动和子任务自动转为进行中`,
      },
    });
  }

  return parentResult.count + childResult.count;
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

function defaultStartDate(stage: string) {
  const offset: Record<string, number> = {
    TR1: 0,
    'TR2&3': 14,
    TR4: 30,
    TR4A: 45,
    TR5: 60,
    TR6: 75,
  };
  return offsetDate(offset[stage] ?? 0);
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function getProjectActivityView(projectId: string) {
  await ensureProjectActivities(projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { currentStage: true, status: true, stageGateStatus: true },
  });
  if (project && project.status !== 'completed' && project.stageGateStatus !== 'completed') {
    await activateProjectStageActivities(projectId, project.currentStage);
  }
  const parents = await prisma.projectActivityParent.findMany({
    where: { projectId },
    select: { id: true },
  });
  await Promise.all(parents.map((parent) => refreshParentSummary(prisma, parent.id)));
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
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function updateActivityParent(params: {
  parentId: string;
  actorUserId: string;
  plannedStartDate?: string | null;
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
      plannedStartDate: parent.plannedStartDate,
      plannedDueDate: parent.plannedDueDate,
      closedAt: parent.closedAt,
    };

    const updateData: Record<string, unknown> = {};
    if ('plannedStartDate' in params) {
      updateData.plannedStartDate = params.plannedStartDate ? new Date(params.plannedStartDate) : null;
    }
    if ('plannedDueDate' in params) {
      updateData.plannedDueDate = params.plannedDueDate ? new Date(params.plannedDueDate) : null;
    }

    if (params.close) {
      const allCompleted = parent.children.length > 0 && parent.children.every(isChildEffectivelyCompleted);
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
          plannedStartDate: updated.plannedStartDate,
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
      const recipientUserIds = updated.assigneeUserId
        ? [updated.assigneeUserId]
        : updated.responsibleRoleId
          ? (await tx.projectMember.findMany({
              where: {
                projectId: updated.projectId,
                user: { positionBinding: { positionRoleId: updated.responsibleRoleId } },
              },
              select: { userId: true },
            })).map((member) => member.userId)
          : [];
      if (recipientUserIds.length > 0) {
        await tx.notification.createMany({
          data: Array.from(new Set(recipientUserIds)).map((recipientUserId) => ({
            recipientUserId,
            projectId: updated.projectId,
            childId: updated.id,
            type: 'child_returned',
            title: '子任务被退回',
            body: params.returnReason!.trim(),
            createdById: params.actorUserId,
          })),
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
  const total = parent.children.length;
  const completed = parent.children.filter(isChildEffectivelyCompleted).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const activeChildren = parent.children.filter((child) => !isChildEffectivelyCompleted(child));
  const hasBlocked = activeChildren.some((child) => child.isBlocked);
  const hasOverdue = activeChildren.some((child) => {
    const due = child.plannedDueDateOverride ?? parent.plannedDueDate;
    return Boolean(due && due < now);
  });

  let status: ParentStatus = PARENT_STATUS.NOT_STARTED;
  if (parent.status === PARENT_STATUS.CLOSED) {
    status = PARENT_STATUS.CLOSED;
  } else if (total > 0 && completed === total) {
    status = PARENT_STATUS.PENDING_NPQ_CLOSE;
  } else if (parent.status === PARENT_STATUS.IN_PROGRESS || parent.children.some((child) => child.status !== CHILD_STATUS.NOT_STARTED || child.isNotApplicable)) {
    status = PARENT_STATUS.IN_PROGRESS;
  }

  await tx.projectActivityParent.update({
    where: { id: parentId },
    data: { progressPercent, hasBlocked, hasOverdue, status },
  });
}

function isChildEffectivelyCompleted(child: { status: string; isNotApplicable: boolean }) {
  return child.status === CHILD_STATUS.COMPLETED || child.isNotApplicable;
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
      const group = child.roleGroup || getRoleGroup(child.ownerRole);
      const role = roleMap.get(group) ?? { roleGroup: group, due: 0, onTime: 0, details: new Map() };
      const detail = role.details.get(child.ownerRole) ?? { due: 0, onTime: 0 };
      role.details.set(child.ownerRole, detail);
      roleMap.set(group, role);

      const due = child.plannedDueDateOverride ?? parent.plannedDueDate;
      const isCompleted = isChildEffectivelyCompleted(child);
      const shouldCount = isCompleted || Boolean(due && due <= now);
      if (!shouldCount) continue;

      const completedAt = child.completedAt ?? (child.isNotApplicable ? child.updatedAt : null);
      const onTime = isCompleted && completedAt && due && completedAt <= due;
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
