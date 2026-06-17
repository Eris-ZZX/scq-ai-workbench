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
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId: session.sub },
      select: {
        user: {
          select: {
            positionBinding: { select: { positionRoleId: true } },
          },
        },
      },
    });
    if (member?.user.positionBinding?.positionRoleId) roleIds.add(member.user.positionBinding.positionRoleId);
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
      members: { some: { userId } },
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

  const userPosition = await prisma.userPosition.findUnique({
    where: { userId: params.session.sub },
    include: { positionRole: { select: { code: true, roleGroup: true } } },
  });
  if (child.responsibleRoleId) {
    return { allowed: userPosition?.positionRoleId === child.responsibleRoleId, child };
  }
  const userRole = userPosition?.positionRole;
  const roleMatches = userRole?.code === child.roleGroup || userRole?.roleGroup === child.roleGroup;
  return { allowed: Boolean(roleMatches), child };
}
