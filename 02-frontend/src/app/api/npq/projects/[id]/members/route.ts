// GET/POST/DELETE /api/npq/projects/[id]/members (F3.S3)
// 🔧 S-2: Added project membership verification to all handlers
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById, getMembers, addMember, removeMember } from '@/lib/db/projects';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { canExecuteNpqAction } from '@/lib/db/npq-permissions';

async function checkMembership(projectId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  const project = await getProjectById(projectId, session.sub);
  if (!project) return { error: '项目不存在', status: 404 };
  return { session, project, status: 0 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });
  const members = await getMembers(id);
  return NextResponse.json(members);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });

  const isOwner = result.project!.members.some((member) => member.userId === result.session!.sub && member.role === 'owner');
  const canAssignPositions = await canExecuteNpqAction({
    actionKey: 'project.assign_positions',
    session: result.session!,
    projectId: id,
  });
  if (!isOwner && !canAssignPositions) return NextResponse.json({ error: '无权添加项目成员' }, { status: 403 });

  let body: { userId?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: '请指定用户' }, { status: 400 });

  try {
    const member = await addMember(id, body.userId, body.role);
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    // 🔧 M-1: 区分 Prisma 错误码
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: '用户已是项目成员' }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json({ error: '用户不存在' }, { status: 422 });
    }
    console.error('[members:POST]', e);
    return NextResponse.json({ error: '添加失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });

  const allowed = await canExecuteNpqAction({
    actionKey: 'project.assign_positions',
    session: result.session!,
    projectId: id,
  });
  if (!allowed) return NextResponse.json({ error: '无权任命项目岗位' }, { status: 403 });

  let body: { positionRoleId?: string; userId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body.positionRoleId) return NextResponse.json({ error: '请指定岗位' }, { status: 400 });

  try {
    if (!body.userId) {
      await prisma.projectPositionAssignment.deleteMany({
        where: { projectId: id, positionRoleId: body.positionRoleId },
      });
      return NextResponse.json({ ok: true });
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: body.userId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: '只能任命项目成员' }, { status: 400 });

    const assignment = await prisma.projectPositionAssignment.upsert({
      where: { projectId_positionRoleId: { projectId: id, positionRoleId: body.positionRoleId } },
      create: {
        projectId: id,
        positionRoleId: body.positionRoleId,
        userId: body.userId,
        appointedById: result.session!.sub,
      },
      update: {
        userId: body.userId,
        appointedById: result.session!.sub,
      },
      include: {
        positionRole: { select: { id: true, code: true, name: true, roleGroup: true } },
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
    return NextResponse.json(assignment);
  } catch (error) {
    console.error('[members:PATCH]', error);
    return NextResponse.json({ error: '岗位任命失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await checkMembership(id);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: '请指定用户' }, { status: 400 });

  // 🔧 H-3/H-4: 不能移除最后一个owner，不能自删
  const owner = result.project!.members.find((m) => m.userId === result.session!.sub && m.role === 'owner');
  if (!owner) return NextResponse.json({ error: '仅项目负责人可移除成员' }, { status: 403 });

  try {
    const { count } = await removeMember(id, userId);
    if (count === 0) return NextResponse.json({ error: '该用户不是项目成员' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'CANNOT_REMOVE_LAST_OWNER') {
      return NextResponse.json({ error: '不能移除唯一的项目负责人' }, { status: 409 });
    }
    throw e;
  }
}
