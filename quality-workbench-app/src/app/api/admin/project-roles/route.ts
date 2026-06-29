import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const roles = await prisma.projectRole.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, name: true, isActive: true, sortOrder: true },
  });
  return NextResponse.json(roles);
}

export async function POST(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const code = clean(body.code);
  const name = clean(body.name) || code;
  if (!code) return NextResponse.json({ error: '请填写角色标识' }, { status: 400 });

  const existing = await prisma.projectRole.findUnique({ where: { code }, select: { id: true } });
  if (existing) return NextResponse.json({ error: '角色标识已存在' }, { status: 409 });

  const count = await prisma.projectRole.count();
  const role = await prisma.projectRole.create({
    data: { code, name, sortOrder: count + 1 },
    select: { id: true, code: true, name: true, isActive: true, sortOrder: true },
  });
  return NextResponse.json(role, { status: 201 });
}

export async function PATCH(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const id = clean(body.id);
  if (!id) return NextResponse.json({ error: '缺少角色 ID' }, { status: 400 });

  const updated = await prisma.projectRole.update({
    where: { id },
    data: {
      name: typeof body.name === 'string' ? clean(body.name) : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    },
    select: { id: true, code: true, name: true, isActive: true, sortOrder: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const id = clean(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少角色 ID' }, { status: 400 });

  // 检查是否有项目成员引用了这个 assignedRole
  const role = await prisma.projectRole.findUnique({ where: { id }, select: { code: true } });
  if (!role) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  const memberCount = await prisma.projectMember.count({ where: { assignedRole: role.code } });
  if (memberCount > 0) {
    return NextResponse.json({ error: `该角色被 ${memberCount} 个项目成员引用，无法删除` }, { status: 409 });
  }

  await prisma.projectRole.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
