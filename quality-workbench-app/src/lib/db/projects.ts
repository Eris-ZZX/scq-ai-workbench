// lib/db/projects.ts — Project + Stage + Member 数据操作 (F3)
import { prisma } from '@/lib/prisma';
import { ensureProjectActivities } from '@/lib/db/activities';

// ─── Project CRUD ───

export function getProjectsByUser(userId: string) {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, username: true } } } },
      stages: { orderBy: { order: 'asc' } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export function getProjectById(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              positionBinding: {
                select: {
                  positionRoleId: true,
                  positionRole: { select: { id: true, code: true, name: true, roleName: true } },
                },
              },
            },
          },
        },
      },
      stages: { orderBy: { order: 'asc' } },
      tasks: { orderBy: { createdAt: 'desc' }, take: 50 },
      _count: { select: { tasks: true } },
    },
  });
}

export async function createProject(params: {
  name: string;
  description?: string;
  ownerId: string;
  templateId?: string;
  activityTemplateSetId?: string;
}) {
  const project = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { name: params.name, description: params.description },
    });
    // Owner membership
    await tx.projectMember.create({
      data: { projectId: project.id, userId: params.ownerId, role: 'owner' },
    });
    // 🔧 H-1: templateId 指定时只用该模板，未指定时用所有 isDefault 模板
    const templates = await tx.stageTemplate.findMany({
      where: params.templateId ? { id: params.templateId } : { isDefault: true },
      orderBy: { order: 'asc' },
    });
    if (templates.length > 0) {
      await tx.projectStage.createMany({
        data: templates.map((t) => ({
          projectId: project.id,
          name: t.name,
          description: t.description,
          order: t.order,
        })),
      });
    }
    return project;
  });
  await ensureProjectActivities(project.id, params.ownerId, params.activityTemplateSetId);
  return project;
}

export async function updateProject(projectId: string, data: { name?: string; description?: string; status?: string }) {
  // 🔧 H-3(static): 状态从completed变走时清空 completedAt
  if (data.status && data.status !== 'completed') {
    return prisma.project.update({
      where: { id: projectId },
      data: { ...data, completedAt: null },
    });
  }
  if (data.status === 'completed') {
    return prisma.project.update({
      where: { id: projectId },
      data: { ...data, completedAt: new Date() },
    });
  }
  return prisma.project.update({ where: { id: projectId }, data });
}

export async function deleteProject(projectId: string) {
  return prisma.project.delete({ where: { id: projectId } });
}

// ─── Members ───

export function getMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          positionBinding: {
            select: {
              positionRoleId: true,
              positionRole: { select: { id: true, code: true, name: true, roleName: true } },
            },
          },
        },
      },
    },
  });
}

export function addMember(projectId: string, userId: string, role = 'member') {
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

// 🔧 H-3: 防止移除最后一个owner + 改为单条删除返回count
export async function removeMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  });
  if (!member) return { count: 0 };
  // 如果要移除的是owner，检查是否还有其他owner
  if (member.role === 'owner') {
    const ownerCount = await prisma.projectMember.count({
      where: { projectId, role: 'owner' },
    });
    if (ownerCount <= 1) {
      throw new Error('CANNOT_REMOVE_LAST_OWNER');
    }
  }
  await prisma.projectMember.delete({ where: { id: member.id } });
  return { count: 1 };
}

// ─── Stages ───

export function getStages(projectId: string) {
  return prisma.projectStage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
}

// 🔧 R3: 服务端计算order，事务内防止竞态
export async function addStage(projectId: string, data: { name: string; description?: string }) {
  return prisma.$transaction(async (tx) => {
    const maxRow = await tx.projectStage.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxRow?.order ?? 0) + 1;
    return tx.projectStage.create({
      data: { projectId, name: data.name, description: data.description, order: nextOrder },
    });
  });
}

// 🔧 M-4/R5: 白名单字段 + completedAt 管理
const STAGE_MUTABLE_FIELDS = ['name', 'status', 'startDate', 'endDate', 'blockedReason'] as const;

export async function updateStage(stageId: string, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};
  for (const key of STAGE_MUTABLE_FIELDS) {
    if (key in data && data[key] !== undefined) updateData[key] = data[key];
  }
  if (updateData.startDate && typeof updateData.startDate === 'string') {
    updateData.startDate = new Date(updateData.startDate);
  }
  if (updateData.endDate && typeof updateData.endDate === 'string') {
    updateData.endDate = new Date(updateData.endDate);
  }
  // 🔧 H-3(static): completed←→other 管理 completedAt
  if (updateData.status === 'completed') {
    updateData.completedAt = new Date();
  } else if (updateData.status) {
    updateData.completedAt = null;
  }
  return prisma.projectStage.update({ where: { id: stageId }, data: updateData });
}

export function deleteStage(stageId: string) {
  return prisma.projectStage.delete({ where: { id: stageId } });
}

// ─── Stage Templates ───

export function getStageTemplates() {
  return prisma.stageTemplate.findMany({
    where: { isDefault: true },
    orderBy: { order: 'asc' },
  });
}
