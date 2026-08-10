import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import {
  DingTalkOrganizationError,
  findDingTalkDirectoryUsersByJobNumber,
} from '@/lib/dingtalk/organization';
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
  if (!employeeNumber) {
    return NextResponse.json(
      { error: '该用户没有 Authing emp_no，无法查询钉钉身份。' },
      { status: 400 },
    );
  }

  try {
    const matches = await findDingTalkDirectoryUsersByJobNumber(employeeNumber);
    if (matches.length === 0) {
      return NextResponse.json(
        { error: `钉钉通讯录中未找到工号 ${employeeNumber}。` },
        { status: 404 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { error: `工号 ${employeeNumber} 匹配到多个钉钉账号，请先处理冲突。` },
        { status: 409 },
      );
    }

    const match = matches[0]!;
    const unionid = match.unionid ?? match.unionId;
    if (!unionid || !match.userid) {
      return NextResponse.json(
        { error: `工号 ${employeeNumber} 的钉钉账号缺少 unionid 或 userid。` },
        { status: 502 },
      );
    }

    const conflict = await db.user.findFirst({
      where: {
        OR: [
          { id: { not: userId }, unionid: String(unionid) },
          { id: { not: userId }, dingtalkUserId: String(match.userid) },
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
        unionid: String(unionid),
        dingtalkUserId: String(match.userid),
      },
    });

    return NextResponse.json({
      userId,
      username: user.username,
      employeeNumber,
      unionid: String(unionid),
      dingtalkUserId: String(match.userid),
    });
  } catch (error) {
    if (error instanceof DingTalkOrganizationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[admin/platform-users/dingtalk/refresh]', error);
    return NextResponse.json({ error: '刷新钉钉身份失败。' }, { status: 500 });
  }
}
