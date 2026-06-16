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

function internalCodeFromName(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  return base || `ROLE-${Date.now().toString(36).toUpperCase()}`;
}

async function uniqueInternalCode(name: string) {
  const base = internalCodeFromName(name);
  let code = base;
  let index = 2;
  while (await prisma.positionRole.findUnique({ where: { code }, select: { id: true } })) {
    code = `${base}-${index}`;
    index += 1;
  }
  return code;
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const positions = await prisma.positionRole.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { roleName: 'asc' }],
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
          permissions: true,
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const groupName = clean(body.groupName ?? body.name);
  const roleName = clean(body.roleName);
  if (!groupName) return NextResponse.json({ error: '请填写分组名称' }, { status: 400 });
  if (!roleName) return NextResponse.json({ error: '请填写角色名称' }, { status: 400 });

  try {
    const existing = await prisma.positionRole.findFirst({ where: { name: groupName, roleName }, select: { id: true } });
    if (existing) return NextResponse.json({ error: '该分组下角色名称已存在' }, { status: 409 });

    const code = await uniqueInternalCode(`${groupName}-${roleName}`);
    const count = await prisma.positionRole.count();
    const created = await prisma.positionRole.create({
      data: {
        code,
        name: groupName,
        roleName,
        roleGroup: internalCodeFromName(groupName),
        sortOrder: count + 1,
      },
      select: {
        id: true,
        name: true,
        roleName: true,
        isActive: true,
        sortOrder: true,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '角色已存在' }, { status: 409 });
    }
    console.error('[positions:POST]', error);
    return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const id = clean(body.id);
  const action = clean(body.action) || 'updateRole';

  if (action === 'renameGroup') {
    const oldGroupName = clean(body.oldGroupName);
    const groupName = clean(body.groupName ?? body.name);
    if (!oldGroupName) return NextResponse.json({ error: '缺少原分组名称' }, { status: 400 });
    if (!groupName) return NextResponse.json({ error: '请填写分组名称' }, { status: 400 });
    if (oldGroupName === groupName) return NextResponse.json({ ok: true });

    try {
      const groupRoles = await prisma.positionRole.findMany({
        where: { name: oldGroupName },
        select: { id: true, roleName: true, name: true },
      });
      if (groupRoles.length === 0) return NextResponse.json({ error: '分组不存在' }, { status: 404 });

      const roleNames = groupRoles.map((role) => role.roleName ?? role.name);
      const conflicts = await prisma.positionRole.findMany({
        where: {
          name: groupName,
          roleName: { in: roleNames },
          NOT: { id: { in: groupRoles.map((role) => role.id) } },
        },
        select: { id: true },
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: '目标分组下已有同名角色' }, { status: 409 });
      }

      await prisma.positionRole.updateMany({
        where: { name: oldGroupName },
        data: { name: groupName, roleGroup: internalCodeFromName(groupName) },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error('[positions:renameGroup]', error);
      return NextResponse.json({ error: '更新分组失败' }, { status: 500 });
    }
  }

  if (!id) return NextResponse.json({ error: '缺少角色 ID' }, { status: 400 });

  const hasGroupName = 'groupName' in body || 'name' in body;
  const hasRoleName = 'roleName' in body;
  const groupName = clean(body.groupName ?? body.name);
  const roleName = clean(body.roleName);

  const current = await prisma.positionRole.findUnique({
    where: { id },
    select: { id: true, name: true, roleName: true },
  });
  if (!current) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  if (hasGroupName && !groupName) return NextResponse.json({ error: '请填写分组名称' }, { status: 400 });
  if (hasRoleName && !roleName) return NextResponse.json({ error: '请填写角色名称' }, { status: 400 });

  const nextGroupName = hasGroupName ? groupName : current.name;
  const nextRoleName = hasRoleName ? roleName : (current.roleName ?? current.name);
  if (nextGroupName !== current.name || nextRoleName !== (current.roleName ?? current.name)) {
    const existing = await prisma.positionRole.findFirst({
      where: { name: nextGroupName, roleName: nextRoleName, NOT: { id } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: '该分组下角色名称已存在' }, { status: 409 });
  }

  try {
    const updated = await prisma.positionRole.update({
      where: { id },
      data: {
        name: hasGroupName ? groupName : undefined,
        roleName: hasRoleName ? roleName : undefined,
        roleGroup: hasGroupName ? internalCodeFromName(groupName) : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      },
      select: {
        id: true,
        name: true,
        roleName: true,
        isActive: true,
        sortOrder: true,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[positions:PATCH]', error);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const id = clean(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少角色 ID' }, { status: 400 });

  const role = await prisma.positionRole.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          userPositions: true,
          projectAssignments: true,
          templateChildren: true,
          activityChildren: true,
          permissions: true,
        },
      },
    },
  });
  if (!role) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  const refCount =
    role._count.userPositions +
    role._count.projectAssignments +
    role._count.templateChildren +
    role._count.activityChildren +
    role._count.permissions;
  if (refCount > 0) {
    return NextResponse.json({ error: '角色已被用户、项目、模板或权限引用，不能直接删除' }, { status: 409 });
  }

  await prisma.positionRole.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
