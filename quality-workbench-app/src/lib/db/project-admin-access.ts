import { prisma } from '@/lib/prisma';

type SessionLike = {
  sub: string;
  role: string;
};

export type ProjectAdminAccess =
  | { kind: 'admin'; userId: string }
  | { kind: 'npq'; userId: string }
  | { kind: 'none'; userId: string };

export async function getProjectAdminAccess(session: SessionLike): Promise<ProjectAdminAccess> {
  if (session.role === 'admin') return { kind: 'admin', userId: session.sub };

  const userPosition = await prisma.userPosition.findUnique({
    where: { userId: session.sub },
    select: {
      positionRole: { select: { code: true, name: true, roleName: true } },
    },
  });
  const roleCode = userPosition?.positionRole.code ?? userPosition?.positionRole.roleName ?? userPosition?.positionRole.name ?? '';
  if (roleCode === 'NPQ') return { kind: 'npq', userId: session.sub };

  return { kind: 'none', userId: session.sub };
}

export function projectScopeWhere(access: ProjectAdminAccess) {
  if (access.kind === 'admin') return {};
  if (access.kind === 'npq') return { members: { some: { userId: access.userId } } };
  return { id: '__never__' };
}

export async function canManageProject(access: ProjectAdminAccess, projectId: string) {
  if (access.kind === 'admin') return true;
  if (access.kind !== 'npq') return false;
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: access.userId } } },
    select: { id: true },
  });
  return Boolean(project);
}
