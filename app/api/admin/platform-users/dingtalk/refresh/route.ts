import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { resolveDingTalkIdentityByUserId } from '@/lib/dingtalk/users';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

function employeeNumberFromExtendedFields(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { emp_no?: unknown };
    return typeof parsed.emp_no === 'string' && parsed.emp_no.trim()
      ? parsed.emp_no.trim()
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!userId) return NextResponse.json({ error: '缺少用户 ID。' }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, extendedFields: true },
  });
  if (!user) return NextResponse.json({ error: '用户不存在。' }, { status: 404 });

  const employeeNumber = employeeNumberFromExtendedFields(user.extendedFields);
  if (employeeNumber && employeeNumber !== user.username) {
    return NextResponse.json(
      { error: `Authing username ${user.username} 与 emp_no ${employeeNumber} 不一致。` },
      { status: 409 },
    );
  }

  try {
    const identity = await resolveDingTalkIdentityByUserId(user.username);
    if (!identity) {
      return NextResponse.json(
        { error: `钉钉用户详情接口未找到 userid ${user.username} 或未返回 unionid。` },
        { status: 404 },
      );
    }

    if (
      employeeNumber &&
      identity.jobNumber &&
      identity.jobNumber !== employeeNumber
    ) {
      return NextResponse.json(
        {
          error: `钉钉 userid ${user.username} 的工号 ${identity.jobNumber} 与 Authing emp_no ${employeeNumber} 不一致。`,
        },
        { status: 409 },
      );
    }

    const conflict = await db.user.findFirst({
      where: {
        OR: [
          { id: { not: userId }, unionid: identity.unionid },
          { id: { not: userId }, dingtalkUserId: identity.userid },
        ],
      },
      select: { id: true, username: true },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: `钉钉身份已绑定其他本地用户：${conflict.username}`,
          conflictUserId: conflict.id,
        },
        { status: 409 },
      );
    }

    await db.user.update({
      where: { id: userId },
      data: {
        unionid: identity.unionid,
        dingtalkUserId: identity.userid,
      },
    });

    return NextResponse.json({
      userId,
      username: user.username,
      employeeNumber,
      matchedBy: 'userid',
      unionid: identity.unionid,
      dingtalkUserId: identity.userid,
    });
  } catch (error) {
    console.error('[admin/platform-users/dingtalk/refresh]', error);
    return NextResponse.json({ error: '刷新钉钉身份失败。' }, { status: 500 });
  }
}
