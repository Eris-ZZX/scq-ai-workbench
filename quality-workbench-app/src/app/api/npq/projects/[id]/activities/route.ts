// GET /api/npq/projects/[id]/activities — F2 项目活动实例 (优化版)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { ensureProjectActivities } from '@/lib/db/activities';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;

  // 查询项目 + 成员 + 活动 + 阶段门禁，一次 Promise.all
  const [project, parents, stageGates] = await Promise.all([
    session.role === 'admin' || session.role === 'manager'
      ? prisma.project.findUnique({
          where: { id },
          select: {
            id: true, name: true, description: true, status: true,
            currentStage: true, currentStageStartedAt: true, stageGateStatus: true,
            createdAt: true, updatedAt: true,
            members: {
              select: {
                id: true, userId: true, role: true, assignedRole: true,
                user: {
                  select: {
                    id: true, username: true,
                    positionBinding: {
                      select: {
                        positionRoleId: true,
                        positionRole: { select: { id: true, name: true, roleName: true } },
                      },
                    },
                  },
                },
              },
            },
            stages: { orderBy: { order: 'asc' } },
          },
        })
      : prisma.project.findFirst({
          where: { id, members: { some: { userId: session.sub } } },
          select: {
            id: true, name: true, description: true, status: true,
            currentStage: true, currentStageStartedAt: true, stageGateStatus: true,
            createdAt: true, updatedAt: true,
            members: {
              select: {
                id: true, userId: true, role: true, assignedRole: true,
                user: {
                  select: {
                    id: true, username: true,
                    positionBinding: {
                      select: {
                        positionRoleId: true,
                        positionRole: { select: { id: true, name: true, roleName: true } },
                      },
                    },
                  },
                },
              },
            },
            stages: { orderBy: { order: 'asc' } },
          },
        }),

    // 纯读：不调 ensure/activate/refresh，只拉数据
    prisma.projectActivityParent.findMany({
      where: { projectId: id },
      include: {
        children: {
          include: { attachments: { where: { deletedAt: null }, select: { id: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),

    prisma.stageGateRecord.findMany({
      where: { projectId: id },
      orderBy: { stage: 'asc' },
    }),
  ]);

  if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

  return NextResponse.json({ project, parents, stageGates });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.sub },
    select: { id: true },
  });
  if (!member && session.role !== 'admin' && session.role !== 'manager') {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  const result = await ensureProjectActivities(id, session.sub);
  return NextResponse.json(result);
}
