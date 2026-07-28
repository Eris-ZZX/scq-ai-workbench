import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import {
  assertNotLastEffectiveAdmin,
  countEffectiveAdmins,
  requireAiResourceRoleApi,
} from '@/modules/ai-resources/guards';
import { membershipRoleSchema } from '@/modules/ai-resources/validation';
import type { AiResourceRole } from '@/modules/ai-resources/roles';

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');

    const [users, memberships, effectiveAdminCount] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, username: true, status: true },
        orderBy: { username: 'asc' },
        take: 500,
      }),
      prisma.aiResourceMembership.findMany({
        include: {
          user: { select: { id: true, username: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      countEffectiveAdmins(),
    ]);

    return NextResponse.json({ users, memberships, effectiveAdminCount });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const payload = membershipRoleSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const { userId, role } = payload.data;
    const subject = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, status: true },
    });
    if (!subject) {
      return NextResponse.json({ error: '用户不存在。' }, { status: 404 });
    }

    const membership = await prisma.$transaction(async (tx) => {
      await assertNotLastEffectiveAdmin(tx, userId, role as AiResourceRole);

      const existing = await tx.aiResourceMembership.findUnique({ where: { userId } });
      const fromRole = existing?.role ?? null;

      const saved = existing
        ? await tx.aiResourceMembership.update({
            where: { userId },
            data: { role, updatedById: actor.userId },
          })
        : await tx.aiResourceMembership.create({
            data: { userId, role, updatedById: actor.userId },
          });

      await tx.aiResourceRoleAudit.create({
        data: {
          membershipId: saved.id,
          subjectUserId: subject.id,
          subjectUserIdSnapshot: subject.id,
          subjectUsernameSnapshot: subject.username,
          actorId: actor.userId,
          fromRole,
          toRole: role,
          action: existing ? 'UPDATE' : 'ASSIGN',
        },
      });

      return saved;
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
