// GET/POST /api/npq/projects/[id]/activities — F2 项目活动实例
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/prisma';
import {
  canAccessProject,
  ensureProjectActivities,
  getActivityEvents,
  getProjectActivityView,
} from '@/lib/db/activities';

const STAGES = ['TR1', 'TR2&3', 'TR4', 'TR4A', 'TR5', 'TR6'];

function stageSortIndex(stage: string) {
  const index = STAGES.indexOf(stage);
  return index >= 0 ? index : STAGES.length;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const allowed = await canAccessProject(id, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const project = session.role === 'admin'
    ? await prisma.project.findUnique({
        where: { id },
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
                      positionRole: { select: { id: true, code: true, name: true, roleName: true, roleGroup: true } },
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
      })
    : await getProjectById(id, session.sub);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const isWorkspaceView = searchParams.get('view') === 'workspace';
  const [parents, events, stageGates] = await Promise.all([
    getProjectActivityView(id, { attachmentMode: isWorkspaceView ? 'summary' : 'detail' }),
    getActivityEvents(id),
    prisma.stageGateRecord.findMany({ where: { projectId: id }, orderBy: { stage: 'asc' } }),
  ]);
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
    events,
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
  const allowed = await canAccessProject(id, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const result = await ensureProjectActivities(id, session.sub);
  return NextResponse.json(result);
}
