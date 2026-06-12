// lib/db/tasks.ts — Task CRUD + 审计 (F4)
import { prisma } from '@/lib/prisma';

// ─── 共享查询片段 ───
const TASK_INCLUDE = {
  stage: { select: { id: true, name: true, status: true } },
  assigneeMember: { select: { id: true, user: { select: { id: true, username: true, displayName: true } } } },
  creator: { select: { id: true, username: true, displayName: true } },
} as const;

// 🔧 F1: 允许的状态转换
const VALID_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress'],
  in_progress: ['done', 'todo'],
  done: ['in_progress'], // 仅可回退到进行中
};

// ─── Query ───

export async function getTasksByProject(projectId: string, userId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });
  if (!member) return [];

  const where = member.role === 'owner' ? { projectId } : { projectId, assigneeMember: { userId } };

  return prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export function getTaskById(taskId: string) {
  return prisma.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE });
}

// ─── Mutations ───

export async function createTask(params: {
  title: string;
  description?: string;
  priority?: string;
  projectId: string;
  stageId?: string;
  assigneeMemberId?: string;
  creatorId: string;
}) {
  // 🔧 F4/R3: 校验 assigneeMemberId 属于同一项目
  if (params.assigneeMemberId) {
    const am = await prisma.projectMember.findUnique({
      where: { id: params.assigneeMemberId },
      select: { projectId: true },
    });
    if (!am || am.projectId !== params.projectId) {
      throw new Error('INVALID_ASSIGNEE');
    }
  }
  // 🔧 M2: 校验 stageId 属于同一项目
  if (params.stageId) {
    const st = await prisma.projectStage.findUnique({
      where: { id: params.stageId },
      select: { projectId: true },
    });
    if (!st || st.projectId !== params.projectId) {
      throw new Error('INVALID_STAGE');
    }
  }

  return prisma.task.create({
    data: {
      title: params.title,
      description: params.description,
      priority: params.priority ?? 'medium',
      projectId: params.projectId,
      stageId: params.stageId ?? null,
      assigneeMemberId: params.assigneeMemberId ?? null,
      creatorId: params.creatorId,
    },
    include: { stage: { select: { id: true, name: true } }, assigneeMember: TASK_INCLUDE.assigneeMember, creator: TASK_INCLUDE.creator },
  });
}

export async function updateTaskStatus(taskId: string, newStatus: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    if (!prev) throw new Error('TASK_NOT_FOUND');

    // 🔧 F1: 状态转换验证
    const allowed = VALID_TRANSITIONS[prev.status];
    if (!allowed?.includes(newStatus)) {
      throw new Error(`INVALID_TRANSITION:${prev.status}->${newStatus}`);
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    updateData.completedAt = newStatus === 'done' ? new Date() : null;

    await tx.task.update({ where: { id: taskId }, data: updateData });

    await tx.taskStatusChange.create({
      data: { taskId, fromStatus: prev.status, toStatus: newStatus, changedBy: userId },
    });

    // 返回含 include 的 task
    return tx.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE });
  });
}

export async function updateTask(taskId: string, data: {
  title?: string; description?: string; priority?: string; stageId?: string | null; assigneeMemberId?: string | null;
}) {
  // 🔧 R3: assignee 校验
  if (data.assigneeMemberId) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (task) {
      const am = await prisma.projectMember.findUnique({ where: { id: data.assigneeMemberId }, select: { projectId: true } });
      if (!am || am.projectId !== task.projectId) return null;
    }
  }
  // 🔧 M2: stage 校验
  if (data.stageId) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (task) {
      const st = await prisma.projectStage.findUnique({ where: { id: data.stageId }, select: { projectId: true } });
      if (!st || st.projectId !== task.projectId) return null;
    }
  }
  return prisma.task.update({ where: { id: taskId }, data, include: TASK_INCLUDE });
}

export async function deleteTask(taskId: string) {
  return prisma.task.delete({ where: { id: taskId } });
}

export function getTaskHistory(taskId: string) {
  return prisma.taskStatusChange.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' } });
}
