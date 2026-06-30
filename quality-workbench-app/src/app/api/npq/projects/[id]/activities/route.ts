// GET /api/npq/projects/[id]/activities — F2 项目活动实例 (优化版)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';
import { ensureProjectActivities } from '@/lib/db/activities';

const STAGES = ['TR1', 'TR2&3', 'TR4', 'TR4A', 'TR5', 'TR6'];

function stageSortIndex(stage: string) {
  const index = STAGES.indexOf(stage);
  return index >= 0 ? index : STAGES.length;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // 读取项目活动，支持 ?view=workspace 时仅返回摘要
    (async () => {
      const { searchParams } = new URL(request.url);
      const isWorkspaceView = searchParams.get('view') === 'workspace';
      return prisma.projectActivityParent.findMany({
        where: { projectId: id },
        include: {
          children: {
            include: isWorkspaceView
              ? undefined
              : { attachments: { where: { deletedAt: null }, select: { id: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
    })(),

    prisma.stageGateRecord.findMany({
      where: { projectId: id },
      orderBy: { stage: 'asc' },
    }),
  ]);

  if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

  // 为每个阶段门禁计算项目活动统计
  const parentStats = new Map<string, { total: number; open: number; blocked: number }>();
  for (const parent of parents) {
    const stats = parentStats.get(parent.stage) ?? { total: 0, open: 0, blocked: 0 };
    stats.total += 1;
    if (parent.status !== 'closed') stats.open += 1;
    if (parent.hasBlocked) stats.blocked += 1;
    parentStats.set(parent.stage, stats);
  }

  return NextResponse.json({
    project,
    parents,
    stageGates: stageGates
      .map((gate) => ({
        ...gate,
        stats: parentStats.get(gate.stage) ?? { total: 0, open: 0, blocked: 0 },
      }))
      .sort((a, b) => stageSortIndex(a.stage) - stageSortIndex(b.stage) || a.stage.localeCompare(b.stage)),
  });
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
