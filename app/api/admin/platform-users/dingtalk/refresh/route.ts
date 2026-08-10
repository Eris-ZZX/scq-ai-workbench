import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { applyDingTalkOrgProfile } from '@/lib/dingtalk/org-profile';
import { resolveDingTalkIdentityByUserId } from '@/lib/dingtalk/users';
import {
  buildEmpOriginIndex,
  matchAuthingSupervisor,
  readAuthingExtendedString,
} from '@/platform/auth/authing-extended-fields';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';
import { mergeUsersIntoPrimary } from '@/platform/auth/user-merge';

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
    select: { id: true, username: true, displayName: true, extendedFields: true },
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

    const result = await db.$transaction(async (transaction) => {
      const conflicts = await transaction.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE id <> ${userId}
          AND (
            unionid = ${identity.unionid}
            OR dingtalk_user_id = ${identity.userid}
            OR (external_source = 'dingtalk' AND external_id = ${identity.unionid})
          )
        FOR UPDATE
      `;
      const mergedUserIds = await mergeUsersIntoPrimary(
        transaction,
        userId,
        conflicts.map((conflict) => conflict.id),
        { preferredEmail: null },
      );
      const authingProfiles = await transaction.$queryRaw<{ display_name: string | null }[]>`
        SELECT display_name
        FROM user_identities
        WHERE user_id = ${userId}
          AND provider = 'authing'
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      const displayName = authingProfiles[0]?.display_name ?? user.displayName;
      await transaction.$queryRaw`
        UPDATE users
        SET display_name = COALESCE(${displayName}::text, display_name),
            unionid = ${identity.unionid},
            dingtalk_user_id = ${user.username}
        WHERE id = ${userId}
      `;
      return { displayName, mergedUserIds };
    });

    const orgProfile = await applyDingTalkOrgProfile(userId, identity);
    let organization: { id: string; name: string; parentId: string | null } | null = null;
    if (orgProfile.primaryDepartmentId) {
      const department = await db.dingTalkDepartment.findUnique({
        where: { id: orgProfile.primaryDepartmentId },
        select: { id: true, name: true, parentId: true },
      });
      organization = department ?? {
        id: orgProfile.primaryDepartmentId,
        name: orgProfile.primaryDepartmentId,
        parentId: null,
      };
    }

    const leaderOriginId = readAuthingExtendedString(user.extendedFields, 'emp_leader_origin_id');
    let supervisor: { directoryUserId: string | null; name: string | null } = {
      directoryUserId: null,
      name: null,
    };
    if (leaderOriginId) {
      const leaders = await db.user.findMany({
        where: { extendedFields: { contains: leaderOriginId } },
        select: {
          id: true,
          username: true,
          displayName: true,
          extendedFields: true,
        },
      });
      const matched = matchAuthingSupervisor(leaderOriginId, buildEmpOriginIndex(leaders));
      if (matched) {
        supervisor = {
          directoryUserId: matched.empOriginId,
          name: matched.displayName || matched.username,
        };
      }
    }

    return NextResponse.json({
      userId,
      username: user.username,
      employeeNumber,
      matchedBy: 'userid',
      displayName: result.displayName,
      unionid: identity.unionid,
      dingtalkUserId: user.username,
      mergedUserIds: result.mergedUserIds,
      positionName: orgProfile.positionName,
      supervisor,
      organization,
    });
  } catch (error) {
    console.error('[admin/platform-users/dingtalk/refresh]', error);
    return NextResponse.json({ error: '刷新钉钉身份失败。' }, { status: 500 });
  }
}
