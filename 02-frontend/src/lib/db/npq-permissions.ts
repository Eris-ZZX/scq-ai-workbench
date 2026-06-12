import { prisma } from '@/lib/prisma';

type SessionLike = {
  sub: string;
  role: string;
};

type PermissionParams = {
  actionKey: string;
  session: SessionLike;
  projectId?: string;
};

export async function getEffectivePositionRoleIds(session: SessionLike, projectId?: string) {
  if (session.role === 'admin') return ['__admin__'];

  const roleIds = new Set<string>();
  if (projectId) {
    const assignments = await prisma.projectPositionAssignment.findMany({
      where: { projectId, userId: session.sub },
      select: { positionRoleId: true },
    });
    assignments.forEach((assignment) => roleIds.add(assignment.positionRoleId));
  }

  const userPosition = await prisma.userPosition.findUnique({
    where: { userId: session.sub },
    select: { positionRoleId: true },
  });
  if (userPosition?.positionRoleId) roleIds.add(userPosition.positionRoleId);

  return Array.from(roleIds);
}

export async function canExecuteNpqAction(params: PermissionParams) {
  if (params.session.role === 'admin') return true;
  if (params.projectId && !(await canAccessProjectScope(params.session.sub, params.projectId))) return false;

  const roleIds = await getEffectivePositionRoleIds(params.session, params.projectId);
  if (roleIds.length === 0) return false;

  const permission = await prisma.npqActionPermission.findFirst({
    where: {
      actionKey: params.actionKey,
      positionRoleId: { in: roleIds },
      canExecute: true,
    },
    select: { id: true },
  });
  return Boolean(permission);
}

async function canAccessProjectScope(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { members: { some: { userId } } },
        { positionAssignments: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(project);
}

export async function canMaintainActivityChild(params: {
  session: SessionLike;
  childId: string;
  returnAction?: boolean;
}) {
  const child = await prisma.projectActivityChild.findUnique({
    where: { id: params.childId },
    select: {
      id: true,
      projectId: true,
      ownerRole: true,
      roleGroup: true,
      responsibleRoleId: true,
      assigneeUserId: true,
    },
  });
  if (!child) return { allowed: false, child: null };
  if (params.session.role === 'admin') return { allowed: true, child };

  if (params.returnAction) {
    const allowed = await canExecuteNpqAction({
      actionKey: 'activity.child_return',
      session: params.session,
      projectId: child.projectId,
    });
    return { allowed, child };
  }

  const canBatchMaintain = await canExecuteNpqAction({
    actionKey: 'activity.batch_update',
    session: params.session,
    projectId: child.projectId,
  });
  if (canBatchMaintain) return { allowed: true, child };

  const canUpdateOwn = await canExecuteNpqAction({
    actionKey: 'activity.child_update_own',
    session: params.session,
    projectId: child.projectId,
  });
  if (!canUpdateOwn) return { allowed: false, child };
  if (child.assigneeUserId === params.session.sub) return { allowed: true, child };

  if (child.responsibleRoleId) {
    const assignment = await prisma.projectPositionAssignment.findUnique({
      where: {
        projectId_positionRoleId: {
          projectId: child.projectId,
          positionRoleId: child.responsibleRoleId,
        },
      },
      select: { userId: true },
    });
    if (assignment?.userId === params.session.sub) return { allowed: true, child };
  }

  const userPosition = await prisma.userPosition.findUnique({
    where: { userId: params.session.sub },
    include: { positionRole: { select: { code: true, roleGroup: true } } },
  });
  const userRole = userPosition?.positionRole;
  const roleMatches = userRole?.code === child.roleGroup || userRole?.roleGroup === child.roleGroup;
  return { allowed: Boolean(roleMatches), child };
}
