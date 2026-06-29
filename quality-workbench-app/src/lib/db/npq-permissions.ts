import { prisma } from '@/lib/prisma';

type SessionLike = { sub: string; role: string };

/** 检查用户在某项目中是否为 owner */
export async function isProjectOwner(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  return member?.role === 'owner';
}

/** 检查用户是否为项目成员（非 observer） */
export async function isProjectMember(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  return member != null && member.role !== 'observer';
}

/** 判断用户是否可以维护某个子活动 */
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
      responsibleRoleId: true,
      assigneeUserId: true,
    },
  });
  if (!child) return { allowed: false, child: null };
  if (params.session.role === 'admin') return { allowed: true, child };

  // Owner can do everything
  const owner = await isProjectOwner(params.session.sub, child.projectId);
  if (owner) return { allowed: true, child };

  // Observer can't do anything
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: child.projectId, userId: params.session.sub } },
    select: { role: true, assignedRole: true },
  });
  if (!member || member.role === 'observer') return { allowed: false, child };

  // Member — can update own tasks
  if (child.assigneeUserId === params.session.sub) return { allowed: true, child };

  // Member — assignedRole in project matches child's ownerRole
  if (member.assignedRole && member.assignedRole === child.ownerRole) return { allowed: true, child };

  return { allowed: false, child };
}
