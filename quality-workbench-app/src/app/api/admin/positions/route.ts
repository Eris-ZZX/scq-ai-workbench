import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true, session };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const positions = await prisma.positionRole.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      roleName: true,
      isActive: true,
      sortOrder: true,
      _count: {
        select: {
          userPositions: true,
          projectAssignments: true,
          templateChildren: true,
          activityChildren: true,
        },
      },
    },
  });
  return NextResponse.json(positions);
}

export async function POST(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const name = clean(body.name ?? body.groupName);
  if (!name) return NextResponse.json({ error: '请填写岗位名称' }, { status: 400 });

  try {
    const existing = await prisma.positionRole.findUnique({ where: { name }, select: { id: true } });
    if (existing) return NextResponse.json({ error: '岗位名称已存在' }, { status: 409 });

    const count = await prisma.positionRole.count();
    const created = await prisma.positionRole.create({
      data: { name, sortOrder: count + 1 },
      select: { id: true, name: true, isActive: true, sortOrder: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '岗位已存在' }, { status: 409 });
    }
    console.error('[positions:POST]', error);
    return NextResponse.json({ error: '创建岗位失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const id = clean(body.id);
  if (!id) return NextResponse.json({ error: '缺少岗位 ID' }, { status: 400 });

  const name = clean(body.name ?? body.groupName);
  if (name) {
    const existing = await prisma.positionRole.findFirst({ where: { name, NOT: { id } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: '岗位名称已存在' }, { status: 409 });
  }

  try {
    const updated = await prisma.positionRole.update({
      where: { id },
      data: {
        name: name || undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      },
      select: { id: true, name: true, isActive: true, sortOrder: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[positions:PATCH]', error);
    return NextResponse.json({ error: '更新岗位失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const id = clean(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少岗位 ID' }, { status: 400 });

  const role = await prisma.positionRole.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: { userPositions: true, projectAssignments: true, templateChildren: true, activityChildren: true },
      },
    },
  });
  if (!role) return NextResponse.json({ error: '岗位不存在' }, { status: 404 });

  const refCount =
    role._count.userPositions + role._count.projectAssignments +
    role._count.templateChildren + role._count.activityChildren;
  if (refCount > 0) {
    return NextResponse.json({ error: '岗位已被用户/项目/模板引用，不能直接删除' }, { status: 409 });
  }

  await prisma.positionRole.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
