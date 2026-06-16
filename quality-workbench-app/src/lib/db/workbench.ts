import { prisma } from '@/lib/prisma';
import { activateProjectStageActivities } from '@/lib/db/activities';
import { getEffectivePositionRoleIds } from '@/lib/db/npq-permissions';

type SessionLike = {
  sub: string;
  username: string;
  role: string;
};

type WorkbenchRole = 'npq' | 'executor' | 'manager' | 'admin';
type TodoType =
  | 'overdue'
  | 'blocked'
  | 'returned'
  | 'missing_deliverable'
  | 'responsibility'
  | 'pending_parent_close';

type WorkbenchTodoItem = {
  id: string;
  type: TodoType;
  projectId: string;
  parentId: string | null;
  childId: string | null;
  stage: string;
  title: string;
  parentTitle: string;
  ownerRole: string;
  status: string;
  dueAt: string | null;
  priorityRank: number;
  allowedActions: string[];
};

const BUSINESS_PROJECT_STATUSES = ['active', 'paused'];

export async function getWorkbenchData(session: SessionLike, options: { projectId?: string } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      role: true,
      positionBinding: {
        select: {
          positionRoleId: true,
          positionRole: { select: { id: true, code: true, name: true, roleName: true, roleGroup: true } },
        },
      },
    },
  });

  const position = user?.positionBinding?.positionRole ?? null;
  const workbenchRole = getWorkbenchRole(session.role, position?.code);
  const roleIds = (await getEffectivePositionRoleIds(session)).filter((id) => id !== '__admin__');
  const memberProjects = await prisma.projectMember.findMany({
    where: { userId: session.sub },
    select: { projectId: true },
  });
  const assignedProjectIds = memberProjects.map((item) => item.projectId);
  const effectiveRoleIds = Array.from(new Set(roleIds));

  const baseProjectWhere = buildProjectWhere(session.sub, workbenchRole, effectiveRoleIds, assignedProjectIds);
  const projectWhere = options.projectId ? { AND: [baseProjectWhere, { id: options.projectId }] } : baseProjectWhere;
  const projects = await prisma.project.findMany({
    where: projectWhere,
    include: {
      members: {
        select: {
          userId: true,
          user: {
            select: {
              positionBinding: {
                select: { positionRole: { select: { code: true } } },
              },
            },
          },
        },
      },
      stageGateRecords: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  await Promise.all(
    projects
      .filter((project) => project.status !== 'completed')
      .map((project) => activateProjectStageActivities(project.id, project.currentStage)),
  );
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
  const projectTodos = workbenchRole === 'admin'
    ? []
    : projectsWithParents.map((project) => {
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
      const nextTodo = group?.todos[0] ?? null;
      return {
        projectId: project.id,
        projectName: project.name,
        currentStage: project.currentStage,
        progressPercent,
        todoCount: group?.todoCount ?? 0,
        nextTodo: nextTodo ? {
          id: nextTodo.id,
          type: nextTodo.type,
          title: nextTodo.title,
          parentTitle: nextTodo.parentTitle,
          stage: nextTodo.stage,
          dueAt: nextTodo.dueAt,
        } : null,
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
      nextTodo: card.nextTodo,
      riskFlags: card.riskFlags,
      updatedAt: card.updatedAt,
    }));

  const projectIds = projects.map((project) => project.id);
  const recentEvents = projectIds.length > 0
    ? await prisma.activityEvent.findMany({
        where: { projectId: { in: projectIds } },
        include: {
          project: { select: { id: true, name: true } },
          actor: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];

  return {
    roleContext: {
      userId: session.sub,
      username: user?.username ?? session.username,
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
      actorName: event.actor?.username ?? null,
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
      members: { some: { userId } },
    };
  }
  if (role === 'npq') {
    return {
      status,
      members: { some: { userId } },
    };
  }
  return {
    status,
    OR: [
      { members: { some: { userId } } },
      { activityChildren: { some: { assigneeUserId: userId, isNotApplicable: false } } },
      assignedProjectIds.length > 0 && effectiveRoleIds.length > 0
        ? { activityChildren: { some: { projectId: { in: assignedProjectIds }, responsibleRoleId: { in: effectiveRoleIds }, isNotApplicable: false } } }
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
    members: Array<{ userId: string; user: { positionBinding: { positionRole: { code: string } } | null } }>;
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
  const todos: WorkbenchTodoItem[] = [];
  const isProjectAssigned = assignedProjectIds.includes(project.id);

  for (const parent of project.activityParents) {
    if (parent.status === 'not_started') continue;

    if (parent.status === 'in_progress' && canSeeNpqProjectTodo(workbenchRole, project, session.sub)) {
      const parentTodoType = getParentTodoType(parent, now);
      if (parentTodoType) {
        todos.push({
          id: `parent:${parent.id}`,
          type: parentTodoType,
          projectId: project.id,
          parentId: parent.id,
          childId: null,
          stage: parent.stage,
          title: parent.projectTaskName,
          parentTitle: parent.projectTaskName,
          ownerRole: 'NPQ',
          status: parent.status,
          dueAt: parent.plannedDueDate?.toISOString() ?? null,
          priorityRank: getTodoPriority(parentTodoType, parent.plannedDueDate, now),
          allowedActions: getAllowedActions(workbenchRole, 'parent'),
        });
      }
    }

    for (const child of parent.children) {
      if (child.status !== 'in_progress') continue;
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

    if (parent.status === 'pending_npq_close' && canSeeNpqProjectTodo(workbenchRole, project, session.sub)) {
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
  if (workbenchRole === 'admin' || workbenchRole === 'manager') return false;
  if (child.assigneeUserId === session.sub) return true;
  if (isProjectAssigned && child.responsibleRoleId && effectiveRoleIds.includes(child.responsibleRoleId)) return true;
  return false;
}

function canSeeNpqProjectTodo(
  workbenchRole: WorkbenchRole,
  project: { members: { userId: string; user: { positionBinding: { positionRole: { code: string } } | null } }[] },
  userId: string,
) {
  if (workbenchRole !== 'npq') return false;
  return project.members.some((member) => member.userId === userId && member.user.positionBinding?.positionRole.code === 'NPQ');
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

function getParentTodoType(
  parent: {
    hasBlocked: boolean;
    hasOverdue: boolean;
    plannedDueDate: Date | null;
    children: Array<{
      status: string;
      isBlocked: boolean;
      plannedDueDateOverride: Date | null;
    }>;
  },
  now: Date,
): TodoType | null {
  const openChildren = parent.children.filter((child) => child.status !== 'completed');
  const hasBlocked = parent.hasBlocked || openChildren.some((child) => child.isBlocked);
  if (hasBlocked) return 'blocked';

  const hasOverdue = parent.hasOverdue || openChildren.some((child) => {
    const due = child.plannedDueDateOverride ?? parent.plannedDueDate;
    return Boolean(due && due < now);
  });
  if (hasOverdue) return 'overdue';

  return null;
}

function getTodoPriority(type: TodoType, dueAt: Date | null, now: Date) {
  const base: Record<TodoType, number> = {
    blocked: 20,
    overdue: 30,
    pending_parent_close: 40,
    returned: 50,
    missing_deliverable: 60,
    responsibility: 100,
  };
  const days = dueAt ? Math.floor((dueAt.getTime() - now.getTime()) / 86_400_000) : 0;
  return base[type] + Math.max(Math.min(days, 30), -30);
}

function getAllowedActions(role: WorkbenchRole, target: 'child' | 'parent') {
  if (role === 'manager') return ['view'];
  if (role === 'admin') return ['view', 'configure'];
  if (role === 'npq') {
    if (target === 'parent') return ['view', 'close_parent'];
    return ['view', 'update', 'complete', 'block', 'attachment', 'return', 'not_applicable', 'adjust'];
  }
  if (target !== 'child') return ['view'];
  return ['view', 'update', 'complete', 'block', 'attachment'];
}

function getProjectRiskFlags(todos: { type: string }[]) {
  const flags = new Set<string>();
  if (todos.some((todo) => todo.type === 'overdue')) flags.add('逾期');
  if (todos.some((todo) => todo.type === 'blocked')) flags.add('阻塞');
  if (todos.some((todo) => todo.type === 'pending_parent_close')) flags.add('待确认关闭');
  return Array.from(flags);
}

function getProjectRiskFlagsFromParents(parents: { hasOverdue: boolean; hasBlocked: boolean; status: string }[]) {
  const flags = new Set<string>();
  if (parents.some((parent) => parent.hasOverdue)) flags.add('逾期');
  if (parents.some((parent) => parent.hasBlocked)) flags.add('阻塞');
  if (parents.some((parent) => parent.status === 'pending_npq_close')) flags.add('待确认关闭');
  return Array.from(flags);
}

function getProjectSortScore(todos: { type: string }[], riskFlags: string[], updatedAt: Date) {
  let score = Math.floor(updatedAt.getTime() / 1_000_000_000);
  if (todos.length > 0) score += 10_000;
  if (todos.some((todo) => todo.type === 'blocked') || riskFlags.includes('阻塞')) score += 10_000;
  if (todos.some((todo) => todo.type === 'overdue') || riskFlags.includes('逾期')) score += 8_000;
  if (todos.some((todo) => todo.type === 'pending_parent_close') || riskFlags.includes('待确认关闭')) score += 6_000;
  return score;
}

function getTodoGroupScore(todos: { priorityRank: number }[], updatedAt: string) {
  const bestPriority = todos.length > 0 ? Math.min(...todos.map((todo) => todo.priorityRank)) : 999;
  return 10_000 - bestPriority + Math.floor(new Date(updatedAt).getTime() / 10_000_000_000);
}
