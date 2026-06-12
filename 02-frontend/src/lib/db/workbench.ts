import { prisma } from '@/lib/prisma';
import { getEffectivePositionRoleIds } from '@/lib/db/npq-permissions';

type SessionLike = {
  sub: string;
  username: string;
  role: string;
  displayName?: string;
};

type WorkbenchRole = 'npq' | 'executor' | 'manager' | 'admin';
type TodoType =
  | 'overdue'
  | 'blocked'
  | 'returned'
  | 'missing_deliverable'
  | 'responsibility'
  | 'pending_parent_close'
  | 'stage_gate';

const BUSINESS_PROJECT_STATUSES = ['active', 'paused'];

export async function getWorkbenchData(session: SessionLike, options: { projectId?: string } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      positionBinding: {
        select: {
          positionRoleId: true,
          positionRole: { select: { id: true, code: true, name: true, roleGroup: true } },
        },
      },
    },
  });

  const position = user?.positionBinding?.positionRole ?? null;
  const workbenchRole = getWorkbenchRole(session.role, position?.code);
  const roleIds = (await getEffectivePositionRoleIds(session)).filter((id) => id !== '__admin__');
  const assignedProjects = await prisma.projectPositionAssignment.findMany({
    where: { userId: session.sub },
    select: { projectId: true, positionRoleId: true },
  });
  const assignedProjectIds = assignedProjects.map((item) => item.projectId);
  const effectiveRoleIds = Array.from(new Set([...roleIds, ...assignedProjects.map((item) => item.positionRoleId)]));

  const baseProjectWhere = buildProjectWhere(session.sub, workbenchRole, effectiveRoleIds, assignedProjectIds);
  const projectWhere = options.projectId ? { AND: [baseProjectWhere, { id: options.projectId }] } : baseProjectWhere;
  const projects = await prisma.project.findMany({
    where: projectWhere,
    include: {
      positionAssignments: { select: { userId: true, positionRole: { select: { code: true } } } },
      stageGateRecords: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  const currentStageParents = projects.length > 0
    ? await prisma.projectActivityParent.findMany({
        where: {
          OR: projects.map((project) => ({ projectId: project.id, stage: project.currentStage })),
        },
        include: {
          children: {
            where: { isNotApplicable: false },
            include: { attachments: { where: { deletedAt: null }, select: { id: true } } },
            orderBy: { updatedAt: 'desc' },
          },
        },
        orderBy: [{ sortOrder: 'asc' }],
      })
    : [];
  const parentsByProject = new Map<string, typeof currentStageParents>();
  for (const parent of currentStageParents) {
    const parents = parentsByProject.get(parent.projectId) ?? [];
    parents.push(parent);
    parentsByProject.set(parent.projectId, parents);
  }
  const projectsWithParents = projects.map((project) => ({
    ...project,
    activityParents: parentsByProject.get(project.id) ?? [],
  }));

  const now = new Date();
  const projectTodos = projectsWithParents.map((project) => {
    const todos = buildProjectTodos({ project, session, workbenchRole, effectiveRoleIds, assignedProjectIds, now });
    return {
      projectId: project.id,
      projectName: project.name,
      currentStage: project.currentStage,
      riskFlags: getProjectRiskFlags(todos),
      todoCount: todos.length,
      todos,
      updatedAt: project.updatedAt.toISOString(),
    };
  }).filter((group) => group.todos.length > 0);

  const allTodos = projectTodos.flatMap((group) => group.todos);
  const projectCards = projectsWithParents
    .map((project) => {
      const group = projectTodos.find((item) => item.projectId === project.id);
      const parentCount = project.activityParents.length;
      const progressPercent = parentCount > 0
        ? Math.round(project.activityParents.reduce((sum, parent) => sum + parent.progressPercent, 0) / parentCount)
        : 0;
      const riskFlags = group?.riskFlags ?? getProjectRiskFlagsFromParents(project.activityParents);
      return {
        projectId: project.id,
        projectName: project.name,
        currentStage: project.currentStage,
        progressPercent,
        todoCount: group?.todoCount ?? 0,
        riskFlags,
        updatedAt: project.updatedAt.toISOString(),
        sortScore: getProjectSortScore(group?.todos ?? [], riskFlags, project.updatedAt),
      };
    })
    .sort((a, b) => b.sortScore - a.sortScore)
    .map((card) => ({
      projectId: card.projectId,
      projectName: card.projectName,
      currentStage: card.currentStage,
      progressPercent: card.progressPercent,
      todoCount: card.todoCount,
      riskFlags: card.riskFlags,
      updatedAt: card.updatedAt,
    }));

  const projectIds = projects.map((project) => project.id);
  const recentEvents = projectIds.length > 0
    ? await prisma.activityEvent.findMany({
        where: { projectId: { in: projectIds } },
        include: {
          project: { select: { id: true, name: true } },
          actor: { select: { displayName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];

  return {
    roleContext: {
      userId: session.sub,
      username: user?.username ?? session.username,
      displayName: user?.displayName ?? session.displayName ?? session.username,
      appRole: session.role,
      position,
      workbenchRole,
    },
    actionMetrics: {
      totalTodo: allTodos.length,
      overdue: allTodos.filter((todo) => todo.type === 'overdue').length,
      blocked: allTodos.filter((todo) => todo.type === 'blocked').length,
      missingDeliverable: allTodos.filter((todo) => todo.type === 'missing_deliverable').length,
      pendingParentClose: allTodos.filter((todo) => todo.type === 'pending_parent_close').length,
    },
    projectTodos: projectTodos
      .sort((a, b) => getTodoGroupScore(b.todos, b.updatedAt) - getTodoGroupScore(a.todos, a.updatedAt))
      .map((group) => ({
        projectId: group.projectId,
        projectName: group.projectName,
        currentStage: group.currentStage,
        riskFlags: group.riskFlags,
        todoCount: group.todoCount,
        todos: group.todos,
      })),
    projectCards,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      projectId: event.projectId,
      projectName: event.project.name,
      actionType: event.actionType,
      note: event.note,
      actorName: event.actor?.displayName ?? event.actor?.username ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function getWorkbenchRole(appRole: string, positionCode?: string | null): WorkbenchRole {
  if (appRole === 'admin') return 'admin';
  if (positionCode === 'NPQ') return 'npq';
  if (positionCode === 'MANAGER') return 'manager';
  return 'executor';
}

function buildProjectWhere(
  userId: string,
  role: WorkbenchRole,
  effectiveRoleIds: string[],
  assignedProjectIds: string[],
) {
  const status = { in: BUSINESS_PROJECT_STATUSES };
  if (role === 'admin') return { status };
  if (role === 'manager') {
    return {
      status,
      OR: [
        { members: { some: { userId } } },
        { positionAssignments: { some: { userId } } },
      ],
    };
  }
  if (role === 'npq') {
    return {
      status,
      OR: [
        { members: { some: { userId } } },
        { positionAssignments: { some: { userId } } },
        { id: { in: assignedProjectIds } },
      ],
    };
  }
  return {
    status,
    OR: [
      { members: { some: { userId } } },
      { positionAssignments: { some: { userId } } },
      { activityChildren: { some: { assigneeUserId: userId, isNotApplicable: false } } },
      effectiveRoleIds.length > 0
        ? { activityChildren: { some: { responsibleRoleId: { in: effectiveRoleIds }, isNotApplicable: false } } }
        : { id: '__never__' },
    ],
  };
}

function buildProjectTodos({
  project,
  session,
  workbenchRole,
  effectiveRoleIds,
  assignedProjectIds,
  now,
}: {
  project: Awaited<ReturnType<typeof prisma.project.findMany>>[number] & {
    positionAssignments: Array<{ userId: string; positionRole: { code: string } }>;
    activityParents: Array<{
      id: string;
      stage: string;
      projectTaskName: string;
      status: string;
      plannedDueDate: Date | null;
      progressPercent: number;
      hasBlocked: boolean;
      hasOverdue: boolean;
      updatedAt: Date;
      children: Array<{
        id: string;
        status: string;
        thirdLevelPlan: string;
        ownerRole: string;
        roleGroup: string;
        responsibleRoleId: string | null;
        assigneeUserId: string | null;
        requiresDeliverable: boolean;
        requiresAttachment: boolean;
        deliverableUrl: string | null;
        isBlocked: boolean;
        plannedDueDateOverride: Date | null;
        updatedAt: Date;
        attachments: { id: string }[];
      }>;
    }>;
    stageGateRecords: Array<{ stage: string; status: string }>;
  };
  session: SessionLike;
  workbenchRole: WorkbenchRole;
  effectiveRoleIds: string[];
  assignedProjectIds: string[];
  now: Date;
}) {
  const todos = [];
  const isProjectAssigned = assignedProjectIds.includes(project.id);

  for (const parent of project.activityParents) {
    for (const child of parent.children) {
      if (child.status === 'completed') continue;
      if (!canSeeChildTodo({ child, session, workbenchRole, effectiveRoleIds, isProjectAssigned })) continue;

      const dueAt = child.plannedDueDateOverride ?? parent.plannedDueDate;
      const type = getChildTodoType(child, dueAt, now);
      todos.push({
        id: `child:${child.id}`,
        type,
        projectId: project.id,
        parentId: parent.id,
        childId: child.id,
        stage: parent.stage,
        title: child.thirdLevelPlan,
        parentTitle: parent.projectTaskName,
        ownerRole: child.ownerRole,
        status: child.status,
        dueAt: dueAt?.toISOString() ?? null,
        priorityRank: getTodoPriority(type, dueAt, now),
        allowedActions: getAllowedActions(workbenchRole, 'child'),
      });
    }

    if (parent.status === 'pending_npq_close' && canSeeParentCloseTodo(workbenchRole, project, session.sub)) {
      todos.push({
        id: `parent:${parent.id}`,
        type: 'pending_parent_close' as TodoType,
        projectId: project.id,
        parentId: parent.id,
        childId: null,
        stage: parent.stage,
        title: parent.projectTaskName,
        parentTitle: parent.projectTaskName,
        ownerRole: 'NPQ',
        status: parent.status,
        dueAt: parent.plannedDueDate?.toISOString() ?? null,
        priorityRank: getTodoPriority('pending_parent_close', parent.plannedDueDate, now),
        allowedActions: getAllowedActions(workbenchRole, 'parent'),
      });
    }
  }

  const currentGate = project.stageGateRecords.find((gate) => gate.stage === project.currentStage);
  const currentStageParents = project.activityParents.filter((parent) => parent.stage === project.currentStage);
  const stageHasBlocker = currentStageParents.some((parent) => parent.hasBlocked);
  const stageHasOpen = currentStageParents.some((parent) => parent.status !== 'closed');
  if ((workbenchRole === 'npq' || workbenchRole === 'manager' || workbenchRole === 'admin') && currentGate?.status === 'pending' && (stageHasBlocker || stageHasOpen)) {
    todos.push({
      id: `stage:${project.id}:${project.currentStage}`,
      type: 'stage_gate' as TodoType,
      projectId: project.id,
      parentId: null,
      childId: null,
      stage: project.currentStage,
      title: `${project.currentStage} 阶段门待推进`,
      parentTitle: '阶段门',
      ownerRole: 'NPQ',
      status: currentGate.status,
      dueAt: null,
      priorityRank: getTodoPriority('stage_gate', null, now),
      allowedActions: getAllowedActions(workbenchRole, 'stage_gate'),
    });
  }

  return todos.sort((a, b) => a.priorityRank - b.priorityRank);
}

function canSeeChildTodo({
  child,
  session,
  workbenchRole,
  effectiveRoleIds,
  isProjectAssigned,
}: {
  child: {
    responsibleRoleId: string | null;
    assigneeUserId: string | null;
  };
  session: SessionLike;
  workbenchRole: WorkbenchRole;
  effectiveRoleIds: string[];
  isProjectAssigned: boolean;
}) {
  if (workbenchRole === 'admin' || workbenchRole === 'manager' || workbenchRole === 'npq') return true;
  if (child.assigneeUserId === session.sub) return true;
  if (isProjectAssigned && child.responsibleRoleId && effectiveRoleIds.includes(child.responsibleRoleId)) return true;
  return false;
}

function canSeeParentCloseTodo(
  workbenchRole: WorkbenchRole,
  project: { positionAssignments: { userId: string; positionRole: { code: string } }[] },
  userId: string,
) {
  if (workbenchRole === 'admin' || workbenchRole === 'manager') return true;
  if (workbenchRole !== 'npq') return false;
  return project.positionAssignments.some((assignment) => assignment.userId === userId && assignment.positionRole.code === 'NPQ');
}

function getChildTodoType(
  child: {
    status: string;
    isBlocked: boolean;
    requiresAttachment: boolean;
    requiresDeliverable: boolean;
    deliverableUrl: string | null;
    attachments: { id: string }[];
  },
  dueAt: Date | null,
  now: Date,
): TodoType {
  if (child.status === 'returned') return 'returned';
  if (child.isBlocked) return 'blocked';
  if (dueAt && dueAt < now) return 'overdue';
  if ((child.requiresAttachment && child.attachments.length === 0) || (child.requiresDeliverable && !child.deliverableUrl)) {
    return 'missing_deliverable';
  }
  return 'responsibility';
}

function getTodoPriority(type: TodoType, dueAt: Date | null, now: Date) {
  const base: Record<TodoType, number> = {
    overdue: 10,
    blocked: 20,
    returned: 30,
    stage_gate: 40,
    pending_parent_close: 50,
    missing_deliverable: 60,
    responsibility: 100,
  };
  const days = dueAt ? Math.floor((dueAt.getTime() - now.getTime()) / 86_400_000) : 99;
  return base[type] + Math.max(Math.min(days, 30), -30);
}

function getAllowedActions(role: WorkbenchRole, target: 'child' | 'parent' | 'stage_gate') {
  if (role === 'manager') return ['view'];
  if (role === 'admin') return ['view', 'configure'];
  if (role === 'npq') {
    if (target === 'parent') return ['view', 'close_parent'];
    if (target === 'stage_gate') return ['view', 'stage_gate'];
    return ['view', 'update', 'complete', 'block', 'attachment', 'return', 'not_applicable', 'adjust'];
  }
  if (target !== 'child') return ['view'];
  return ['view', 'update', 'complete', 'block', 'attachment'];
}

function getProjectRiskFlags(todos: { type: string }[]) {
  const flags = new Set<string>();
  if (todos.some((todo) => todo.type === 'overdue')) flags.add('逾期');
  if (todos.some((todo) => todo.type === 'blocked')) flags.add('阻塞');
  if (todos.some((todo) => todo.type === 'missing_deliverable')) flags.add('缺交付件');
  if (todos.some((todo) => todo.type === 'pending_parent_close')) flags.add('待关闭');
  if (todos.some((todo) => todo.type === 'stage_gate')) flags.add('阶段门');
  return Array.from(flags);
}

function getProjectRiskFlagsFromParents(parents: { hasOverdue: boolean; hasBlocked: boolean; status: string }[]) {
  const flags = new Set<string>();
  if (parents.some((parent) => parent.hasOverdue)) flags.add('逾期');
  if (parents.some((parent) => parent.hasBlocked)) flags.add('阻塞');
  if (parents.some((parent) => parent.status === 'pending_npq_close')) flags.add('待关闭');
  return Array.from(flags);
}

function getProjectSortScore(todos: { type: string }[], riskFlags: string[], updatedAt: Date) {
  let score = Math.floor(updatedAt.getTime() / 1_000_000_000);
  if (todos.length > 0) score += 10_000;
  if (riskFlags.includes('逾期') || riskFlags.includes('阻塞')) score += 8_000;
  if (riskFlags.includes('阶段门')) score += 5_000;
  if (riskFlags.includes('待关闭')) score += 3_000;
  return score;
}

function getTodoGroupScore(todos: { priorityRank: number }[], updatedAt: string) {
  const bestPriority = todos.length > 0 ? Math.min(...todos.map((todo) => todo.priorityRank)) : 999;
  return 10_000 - bestPriority + Math.floor(new Date(updatedAt).getTime() / 10_000_000_000);
}
