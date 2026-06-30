import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';
import bcrypt from 'bcryptjs';

function isAdminOrManager(role: string) {
  return role === 'admin' || role === 'manager';
}

async function checkAdmin(writeOp = false) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (writeOp ? session.role !== 'admin' : !isAdminOrManager(session.role)) {
    return { error: '需要管理员权限', status: 403 };
  }
  return { ok: true, session };
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, role: true, status: true, email: true, createdAt: true,
      positionBinding: {
        select: { positionRoleId: true, positionRole: { select: { id: true, name: true, roleName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const r = await checkAdmin(true);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { username?: string; password?: string; email?: string | null; role?: string; status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;
  const email = body.email?.trim() || null;
  const role = body.role === 'admin' ? 'admin' : body.role === 'manager' ? 'manager' : 'user';
  const status = body.status === 'disabled' ? 'disabled' : 'active';

  if (!username || !password) return NextResponse.json({ error: '请填写用户名和密码' }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) return NextResponse.json({ error: '用户名须为 1-50 位字母、数字、下划线或连字符' }, { status: 400 });
  if (password.length < 6 || password.length > 128) return NextResponse.json({ error: '密码长度应为 6-128 位' }, { status: 400 });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: { username, passwordHash, email, role, status },
      select: {
        id: true, username: true, role: true, status: true, email: true, createdAt: true,
        positionBinding: {
          select: { positionRoleId: true, positionRole: { select: { id: true, name: true, roleName: true } } },
        },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '用户名或邮箱已存在' }, { status: 409 });
    }
    console.error('[admin/users:POST]', error);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const r = await checkAdmin(true);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { id?: string; role?: string; status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: '请指定用户' }, { status: 400 });
  const userId = body.id;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!targetUser) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  if (targetUser.username === 'admin') {
    if (body.status && body.status !== 'active') {
      return NextResponse.json({ error: 'admin 是超级管理账号，不能禁用' }, { status: 400 });
    }
    if (body.role && body.role !== 'admin') {
      return NextResponse.json({ error: 'admin 是超级管理账号，不能取消管理员权限' }, { status: 400 });
    }
  }

  try {
    if (body.role || body.status) {
      const role = body.role === 'admin' ? 'admin' : body.role === 'manager' ? 'manager' : body.role === 'user' ? 'user' : undefined;
      await prisma.user.update({
        where: { id: body.id },
        data: { role, status: body.status },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, role: true, status: true,
        positionBinding: {
          select: { positionRoleId: true, positionRole: { select: { id: true, name: true, roleName: true } } },
        },
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('[admin/users:PATCH]', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
