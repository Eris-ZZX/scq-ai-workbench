import { prisma } from '@/lib/prisma';

type SessionLike = {
  sub: string;
  role: string;
};

export type ProjectAdminAccess =
  | { kind: 'admin'; userId: string }
  | { kind: 'member'; userId: string }
  | { kind: 'none'; userId: string };

export async function getProjectAdminAccess(session: SessionLike): Promise<ProjectAdminAccess> {
  if (session.role === 'admin' || session.role === 'manager') return { kind: 'admin', userId: session.sub };

  // 有任何项目成员身份即可进入项目管理页面（含 observer）
  const member = await prisma.projectMember.findFirst({
    where: { userId: session.sub },
    select: { id: true },
  });
  if (member) return { kind: 'member', userId: session.sub };

  return { kind: 'none', userId: session.sub };
}

export function projectScopeWhere(access: ProjectAdminAccess) {
  if (access.kind === 'admin') return {};
  if (access.kind === 'member') return { members: { some: { userId: access.userId } } };
  return { id: '__never__' };
}

export async function canManageProject(access: ProjectAdminAccess, projectId: string) {
  if (access.kind === 'admin') return true;
  if (access.kind !== 'member') return false;
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: access.userId } } },
    select: { id: true },
  });
  return Boolean(project);
}
