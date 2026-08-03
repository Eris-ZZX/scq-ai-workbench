import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, isUniqueViolation, type DatabaseClient } from '@/lib/database';
import { assertNotLastEffectiveAdmin } from '@/modules/ai-resources/guards';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

const PLATFORM_ROLES = new Set(['user', 'admin']);
const WORKBENCH_ROLES = new Set(['user', 'manager', 'admin']);
const ACCOUNT_STATUSES = new Set(['active', 'disabled']);
const AI_RESOURCE_ROLES = new Set(['user', 'reviewer', 'admin']);

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function userWhere(query: string) {
  if (!query) return undefined;
  return {
    OR: [
      { username: { contains: query } },
      { email: { contains: query } },
    ],
  };
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  platformRole: true,
  role: true,
  status: true,
  externalSource: true,
  externalId: true,
  dingtalkUserId: true,
  supervisorDingtalkUserId: true,
  supervisorName: true,
  syncAt: true,
  createdAt: true,
  updatedAt: true,
  positionBinding: {
    select: {
      id: true,
      positionRoleId: true,
      positionRole: { select: { id: true, name: true, roleName: true, isActive: true } },
    },
  },
  aiResourceMembership: {
    select: { id: true, role: true, updatedAt: true },
  },
  projectMembers: {
    select: { id: true },
  },
} as const;

function serializeUser(user: any) {
  const position = Array.isArray(user.positionBinding)
    ? user.positionBinding[0] ?? null
    : user.positionBinding ?? null;
  const aiMembership = Array.isArray(user.aiResourceMembership)
    ? user.aiResourceMembership[0] ?? null
    : user.aiResourceMembership ?? null;

  return {
    ...user,
    source: user.externalSource || 'local',
    platformRole: user.platformRole ?? (user.role === 'admin' ? 'admin' : 'user'),
    workbenchRole: user.role,
    supervisor: {
      dingtalkUserId: user.supervisorDingtalkUserId ?? null,
      name: user.supervisorName ?? null,
    },
    position,
    aiResourceRole: aiMembership?.role ?? null,
    aiResourceMembershipId: aiMembership?.id ?? null,
    projectCount: user.projectMembers?.length ?? 0,
    positionBinding: undefined,
    aiResourceMembership: undefined,
    role: undefined,
    projectMembers: undefined,
  };
}

async function writePermissionAudit(
  tx: DatabaseClient,
  input: {
    actorId: string;
    subjectUserId: string;
    permissionType: string;
    fromValue: unknown;
    toValue: unknown;
    projectId?: string;
  },
) {
  await tx.observabilityEvent.create({
    data: {
      traceId: crypto.randomUUID(),
      eventType: 'USER_PERMISSION_CHANGED',
      path: '/api/admin/platform-users',
      method: 'PATCH',
      userId: input.actorId,
      projectId: input.projectId ?? null,
      requestBody: JSON.stringify({
        subjectUserId: input.subjectUserId,
        permissionType: input.permissionType,
        from: input.fromValue,
        to: input.toValue,
      }),
      responseSummary: 'platform user permission updated',
      statusCode: 200,
    },
  });
}

async function findSubject(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, platformRole: true, role: true, status: true },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const query = clean(request.nextUrl.searchParams.get('q'));
  const where = userWhere(query);
  const [users, platformAdminCount, workbenchAdminCount, aiAdminCount] = await Promise.all([
    db.user.findMany({
      where,
      select: userSelect,
      orderBy: { username: 'asc' },
      take: 1000,
    }),
    db.user.count({ where: { platformRole: 'admin', status: 'active' } }),
    db.user.count({ where: { role: 'admin', status: 'active' } }),
    db.aiResourceMembership.count({ where: { role: 'admin', user: { status: 'active' } } }),
  ]);

  return NextResponse.json({
    users: users.map(serializeUser),
    safeguards: {
      activePlatformAdminCount: platformAdminCount,
      activeWorkbenchAdminCount: workbenchAdminCount,
      activeAiResourceAdminCount: aiAdminCount,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const username = clean(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';
  const email = clean(body?.email) || null;
  const platformRole = clean(body?.platformRole) || 'user';
  const workbenchRole = clean(body?.workbenchRole) || 'user';
  const status = clean(body?.status) || 'active';

  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) {
    return NextResponse.json({ error: '用户名须为 1-50 位字母、数字、下划线或连字符。' }, { status: 400 });
  }
  if (password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: '密码长度应为 6-128 位。' }, { status: 400 });
  }
  if (!PLATFORM_ROLES.has(platformRole) || !WORKBENCH_ROLES.has(workbenchRole) || !ACCOUNT_STATUSES.has(status)) {
    return NextResponse.json({ error: '平台角色、质量工作台角色或账号状态无效。' }, { status: 400 });
  }

  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          passwordHash: await bcrypt.hash(password, 12),
          email,
          platformRole,
          role: workbenchRole,
          status,
        },
        select: { id: true, username: true, email: true, platformRole: true, role: true, status: true },
      });
      await writePermissionAudit(tx, {
        actorId: auth.session.sub,
        subjectUserId: created.id,
        permissionType: 'account_created',
        fromValue: null,
        toValue: { platformRole, workbenchRole, status, source: 'local' },
      });
      return created;
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: '用户名或邮箱已存在。' }, { status: 409 });
    }
    console.error('[admin/platform-users:POST]', error);
    return NextResponse.json({ error: '创建用户失败。' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const userId = clean(body?.userId);
  const action = clean(body?.action);
  if (!userId) return NextResponse.json({ error: '缺少用户 ID。' }, { status: 400 });

  const subject = await findSubject(userId);
  if (!subject) return NextResponse.json({ error: '用户不存在。' }, { status: 404 });

  try {
    if (action === 'platform' || action === 'account') {
      const nextPlatformRole = body?.platformRole === undefined ? subject.platformRole : clean(body.platformRole);
      const nextStatus = body?.status === undefined ? subject.status : clean(body.status);
      if (!PLATFORM_ROLES.has(nextPlatformRole) || !ACCOUNT_STATUSES.has(nextStatus)) {
        return NextResponse.json({ error: '平台角色或账号状态无效。' }, { status: 400 });
      }
      if (subject.username === 'admin' && (nextPlatformRole !== 'admin' || nextStatus !== 'active')) {
        return NextResponse.json({ error: 'admin 是超级管理账号，不能降级或禁用。' }, { status: 400 });
      }

      await db.$transaction(async (tx) => {
        if (
          subject.platformRole === 'admin' &&
          subject.status === 'active' &&
          (nextPlatformRole !== 'admin' || nextStatus !== 'active')
        ) {
          if (typeof tx.$queryRaw === 'function') {
            await tx.$queryRaw`SELECT id FROM users WHERE platform_role = 'admin' AND status = 'active' FOR UPDATE`;
          }
          const count = await tx.user.count({ where: { platformRole: 'admin', status: 'active' } });
          if (count <= 1) throw new Error('CANNOT_REMOVE_LAST_PLATFORM_ADMIN');
        }
        await tx.user.update({
          where: { id: userId },
          data: { platformRole: nextPlatformRole, status: nextStatus },
        });
        await writePermissionAudit(tx, {
          actorId: auth.session.sub,
          subjectUserId: userId,
          permissionType: 'platform_role_status',
          fromValue: { platformRole: subject.platformRole, status: subject.status },
          toValue: { platformRole: nextPlatformRole, status: nextStatus },
        });
      });
    } else if (action === 'workbench-role') {
      const nextRole = clean(body?.role);
      if (!WORKBENCH_ROLES.has(nextRole)) {
        return NextResponse.json({ error: '质量工作台角色无效。' }, { status: 400 });
      }
      if (subject.username === 'admin' && nextRole !== 'admin') {
        return NextResponse.json({ error: 'admin 是兜底管理员，不能移除质量工作台管理员角色。' }, { status: 400 });
      }

      await db.$transaction(async (tx) => {
        if (subject.role === 'admin' && subject.status === 'active' && nextRole !== 'admin') {
          if (typeof tx.$queryRaw === 'function') {
            await tx.$queryRaw`SELECT id FROM users WHERE role = 'admin' AND status = 'active' FOR UPDATE`;
          }
          const count = await tx.user.count({ where: { role: 'admin', status: 'active' } });
          if (count <= 1) throw new Error('CANNOT_REMOVE_LAST_WORKBENCH_ADMIN');
        }
        await tx.user.update({
          where: { id: userId },
          data: { role: nextRole },
        });
        await writePermissionAudit(tx, {
          actorId: auth.session.sub,
          subjectUserId: userId,
          permissionType: 'workbench_role',
          fromValue: subject.role,
          toValue: nextRole,
        });
      });
    } else if (action === 'ai-resource-role') {
      const role = clean(body?.role);
      if (!AI_RESOURCE_ROLES.has(role)) {
        return NextResponse.json({ error: 'AI 资源角色无效。' }, { status: 400 });
      }

      await db.$transaction(async (tx) => {
        await assertNotLastEffectiveAdmin(tx, userId, role as 'user' | 'reviewer' | 'admin');
        const existing = await tx.aiResourceMembership.findUnique({ where: { userId } });
        const fromRole = existing?.role ?? null;
        await (existing
          ? tx.aiResourceMembership.update({
              where: { userId },
              data: { role, updatedById: auth.session.sub },
            })
          : tx.aiResourceMembership.create({
              data: { userId, role, updatedById: auth.session.sub },
            }));
        await writePermissionAudit(tx, {
          actorId: auth.session.sub,
          subjectUserId: userId,
          permissionType: 'ai_resource_role',
          fromValue: fromRole,
          toValue: role,
        });
      });
    } else {
      return NextResponse.json({ error: '不支持的权限操作。' }, { status: 400 });
    }

    const updated = await db.user.findUnique({ where: { id: userId }, select: userSelect });
    return NextResponse.json(updated ? serializeUser(updated) : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const knownErrors: Record<string, [string, number]> = {
      CANNOT_REMOVE_LAST_PLATFORM_ADMIN: ['不能移除最后一个有效平台管理员。', 409],
      CANNOT_REMOVE_LAST_WORKBENCH_ADMIN: ['不能移除最后一个有效质量工作台管理员。', 409],
      不能移除末位有效模块管理员: ['不能移除最后一个有效 AI 资源管理员。', 409],
    };
    const knownError = knownErrors[message];
    if (knownError) {
      const [errorMessage, status] = knownError;
      return NextResponse.json({ error: errorMessage }, { status });
    }
    console.error('[admin/platform-users:PATCH]', error);
    return NextResponse.json({ error: '权限更新失败。' }, { status: 500 });
  }
}
