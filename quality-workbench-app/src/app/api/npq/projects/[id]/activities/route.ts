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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const [parents, events, stageGates] = await Promise.all([
    getProjectActivityView(id),
    getActivityEvents(id),
    prisma.stageGateRecord.findMany({ where: { projectId: id }, orderBy: { stage: 'asc' } }),
  ]);
  return NextResponse.json({ project, parents, events, stageGates });
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
