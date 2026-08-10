import { db } from '@/lib/database';
import { getCorpAccessToken } from './token';

export type DingTalkIdentity = {
  userid: string;
  unionid: string;
  jobNumber?: string;
  title?: string | null;
  managerUserId?: string | null;
  name?: string | null;
  departmentIds: string[];
  departmentOrders: Record<string, number>;
};

type DingTalkUserDetailResult = {
  userid?: string;
  unionid?: string;
  name?: string;
  title?: string;
  manager_userid?: string;
  managerUserid?: string;
  job_number?: string | number;
  jobnumber?: string | number;
  dept_id_list?: Array<number | string>;
  deptIdList?: Array<number | string>;
  dept_order_list?: Array<{
    dept_id?: number | string;
    deptId?: number | string;
    order?: number;
  }> | Record<string, number>;
  deptOrderList?: Array<{
    dept_id?: number | string;
    deptId?: number | string;
    order?: number;
  }> | Record<string, number>;
};

function normalizeDepartmentIds(result: DingTalkUserDetailResult): string[] {
  const values = result.dept_id_list ?? result.deptIdList ?? [];
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)));
}

function normalizeDepartmentOrders(result: DingTalkUserDetailResult): Record<string, number> {
  const values = result.dept_order_list ?? result.deptOrderList;
  if (!values) return {};

  if (Array.isArray(values)) {
    return Object.fromEntries(
      values
        .filter((item) => item.dept_id !== undefined || item.deptId !== undefined)
        .map((item) => [
          String(item.dept_id ?? item.deptId),
          Number.isFinite(item.order) ? Number(item.order) : 0,
        ]),
    );
  }

  return Object.fromEntries(
    Object.entries(values).map(([departmentId, order]) => [
      String(departmentId),
      Number.isFinite(order) ? Number(order) : 0,
    ]),
  );
}

export async function resolveUserIdByUnionId(unionId: string): Promise<string | null> {
  const token = await getCorpAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unionid: unionId }),
    },
  );
  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    result?: { userid?: string };
  };
  if (!res.ok || data.errcode !== 0 || !data.result?.userid) {
    console.error('[dingtalk] getbyunionid failed:', data);
    return null;
  }
  return data.result.userid;
}

/**
 * 通过钉钉企业通讯录 userid 查询完整身份。
 *
 * Authing username 在当前组织内就是钉钉 userid，因此登录绑定和管理员
 * 刷新都统一走这条官方接口链路，避免依赖手机号查询或部门遍历权限。
 */
export async function resolveDingTalkIdentityByUserId(
  userId: string,
): Promise<DingTalkIdentity | null> {
  const token = await getCorpAccessToken();
  const normalizedUserId = userId.trim();
  if (!token || !normalizedUserId) return null;

  const res = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: normalizedUserId, language: 'zh_CN' }),
    },
  );
  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    result?: DingTalkUserDetailResult;
  };
  const result = data.result;
  const returnedUserId = result?.userid?.trim();
  const unionId = result?.unionid?.trim();
  if (
    !res.ok ||
    data.errcode !== 0 ||
    !returnedUserId ||
    returnedUserId !== normalizedUserId ||
    !unionId
  ) {
    console.error('[dingtalk] user detail lookup failed:', {
      status: res.status,
      errcode: data.errcode ?? null,
      errmsg: data.errmsg ?? null,
      requestedUserId: normalizedUserId,
      returnedUserId: returnedUserId ?? null,
      hasUnionId: Boolean(unionId),
    });
    return null;
  }

  if (!result) return null;
  const jobNumber = result.job_number ?? result.jobnumber;
  const title = result.title?.trim() || null;
  const managerUserId = (result.manager_userid ?? result.managerUserid)?.trim() || null;
  const name = result.name?.trim() || null;
  return {
    userid: returnedUserId,
    unionid: unionId,
    jobNumber: jobNumber === undefined ? undefined : String(jobNumber).trim(),
    title,
    managerUserId,
    name,
    departmentIds: normalizeDepartmentIds(result),
    departmentOrders: normalizeDepartmentOrders(result),
  };
}

/** 取用户的钉钉 unionId：优先读 users.unionid 列（Authing 来源兼容），旧 dingtalk 来源读 external_id */
async function readDingTalkUnionId(user: {
  unionid: string | null;
  externalSource: string | null;
  externalId: string | null;
}): Promise<string | null> {
  if (user.unionid) return user.unionid;
  if (user.externalSource === 'dingtalk' && user.externalId) return user.externalId;
  return null;
}

/** Resolve corp userid for a local user; persist when found. */
export async function ensureDingTalkUserId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dingtalkUserId: true,
      unionid: true,
      externalSource: true,
      externalId: true,
    },
  });
  if (!user) return null;
  if (user.dingtalkUserId) return user.dingtalkUserId;

  const unionId = await readDingTalkUnionId(user);
  if (!unionId) return null;

  const userid = await resolveUserIdByUnionId(unionId);
  if (!userid) return null;

  await db.user.update({
    where: { id: user.id },
    data: { dingtalkUserId: userid },
  });
  return userid;
}

export async function getDingTalkUnionId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { unionid: true, externalSource: true, externalId: true },
  });
  if (!user) return null;
  return readDingTalkUnionId(user);
}

/**
 * 所有激活的平台用户都是 AI 资源库成员（共用用户表），
 * 发布通知发给所有有钉钉 userid（或可解析）的用户。
 */
export async function listPublishNotifyUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      dingtalkUserId: true,
      unionid: true,
      externalSource: true,
      externalId: true,
    },
  });

  const userIds: string[] = [];
  for (const u of users) {
    if (u.dingtalkUserId) {
      userIds.push(u.dingtalkUserId);
      continue;
    }
    const unionId = await readDingTalkUnionId(u);
    if (unionId) {
      const resolved = await ensureDingTalkUserId(u.id);
      if (resolved) userIds.push(resolved);
    }
  }
  return [...new Set(userIds)];
}
