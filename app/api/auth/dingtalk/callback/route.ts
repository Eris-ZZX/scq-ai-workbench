// GET /api/auth/dingtalk/callback — 钉钉 OAuth2.0 回调
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession } from '@/platform/auth/auth.config';
import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';
import { getRequestUrl } from '@/platform/auth/request-url';
import { AUTH_RETURN_COOKIE, resolveReturnPath } from '@/platform/auth/return-path';
import { defaultSecureCookie } from '@/platform/auth/auth.jwt';
import {
  findDingTalkUser,
  createDingTalkUser,
  syncDingTalkUser,
  type DingTalkProfile,
} from '@/lib/db/dingtalk';
import {
  normalizeDepartmentIds,
  normalizeDepartmentOrders,
  ensurePositionRole,
  bindUserPosition,
} from '@/lib/dingtalk/organization';

const STATE_COOKIE = 'dingtalk_oauth_state';

function getDingTalkConfig() {
  const clientId = process.env.DINGTALK_CLIENT_ID;
  const clientSecret = process.env.DINGTALK_CLIENT_SECRET;
  const redirectUri = process.env.DINGTALK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

function loginErrorRedirect(request: Request, error: string) {
  const url = getRequestUrl(request, '/login');
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  try {
    const config = getDingTalkConfig();
    if (!config) return loginErrorRedirect(request, 'dingtalk');

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) return loginErrorRedirect(request, 'dingtalk');

    // 校验 state
    const jar = await cookies();
    const storedState = jar.get(STATE_COOKIE)?.value;
    if (!storedState || storedState !== state) {
      return loginErrorRedirect(request, 'dingtalk_csrf');
    }

    jar.set(STATE_COOKIE, '', {
      httpOnly: true,
      secure: defaultSecureCookie(),
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    // 第 1 步：code → accessToken
    const tokenRes = await fetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        grantType: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[dingtalk] userAccessToken HTTP', tokenRes.status);
      return loginErrorRedirect(request, 'dingtalk_token');
    }

    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.accessToken;
    if (!accessToken) {
      console.error('[dingtalk] No accessToken:', JSON.stringify(tokenData));
      return loginErrorRedirect(request, 'dingtalk_token');
    }

    // 第 2 步：获取钉钉用户档案（nick, avatarUrl, email, unionId, openId）
    const meRes = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
      headers: { 'x-acs-dingtalk-access-token': accessToken },
    });

    if (!meRes.ok) {
      const text = await meRes.text();
      console.error('[dingtalk] users/me HTTP', meRes.status, text);
      return loginErrorRedirect(request, 'dingtalk_token');
    }

    const meData = await meRes.json();
    console.info('[dingtalk] users/me profile received');

    const profile: DingTalkProfile = {
      unionId: meData.unionId,
      nick: meData.nick || `dt_${(meData.unionId || meData.openId || 'user').slice(0, 8)}`,
      avatarUrl: meData.avatarUrl ?? undefined,
      email: meData.email ?? undefined,
    };

    // 第 2.5 步：获取钉钉通讯录职位（title）
    if (profile.unionId) {
      try {
        console.log('[dingtalk] fetching corp token for title lookup...');
        const corpTokenRes = await fetch(
          `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(config.clientId)}&appsecret=${encodeURIComponent(config.clientSecret)}`,
        );
        const corpStatus = corpTokenRes.status;
        const corpText = await corpTokenRes.text();
        console.info('[dingtalk] gettoken status:', corpStatus);
        if (corpTokenRes.ok) {
          const corpData = JSON.parse(corpText) as { errcode: number; access_token?: string };
          if (corpData.errcode === 0 && corpData.access_token) {
            const at = corpData.access_token;
            console.log('[dingtalk] got corp token, fetching userid via unionId...');
            const idRes = await fetch(
              `https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${at}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unionid: profile.unionId }) },
            );
            const idText = await idRes.text();
            console.info('[dingtalk] getbyunionid status:', idRes.status);
            if (idRes.ok) {
              const idData = JSON.parse(idText) as { errcode: number; result?: { userid?: string } };
              if (idData.errcode === 0 && idData.result?.userid) {
                profile.dingtalkUserId = idData.result.userid;
                const detailRes = await fetch(
                  `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${at}`,
                  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userid: idData.result.userid }) },
                );
                const detailText = await detailRes.text();
                console.info('[dingtalk] topapi getuser status:', detailRes.status);
                if (detailRes.ok) {
                  const detail = JSON.parse(detailText) as {
                    errcode: number;
                    result?: {
                      title?: string;
                      job_number?: string;
                      mobile?: string;
                      managerUserid?: string;
                      manager_userid?: string;
                      deptIdList?: Array<number | string>;
                      dept_id_list?: Array<number | string>;
                      deptOrderList?: Array<{ dept_id?: number | string; deptId?: number | string; order?: number }> | Record<string, number>;
                      dept_order_list?: Array<{ dept_id?: number | string; deptId?: number | string; order?: number }> | Record<string, number>;
                    };
                  };
                  if (detail.errcode === 0 && detail.result) {
                    profile.departmentIds = normalizeDepartmentIds(detail.result);
                    profile.departmentOrders = normalizeDepartmentOrders(detail.result);
                    profile.jobNumber = detail.result.job_number;
                    profile.mobile = detail.result.mobile;
                    if (detail.result.title) {
                      profile.title = detail.result.title;
                      console.info('[dingtalk] user position synchronized');
                    }

                    const supervisorDingtalkUserId =
                      detail.result.managerUserid ?? detail.result.manager_userid;
                    if (supervisorDingtalkUserId) {
                      profile.supervisorDingtalkUserId = supervisorDingtalkUserId;
                      const supervisorRes = await fetch(
                        `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${at}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userid: supervisorDingtalkUserId }),
                        },
                      );
                      if (supervisorRes.ok) {
                        const supervisorText = await supervisorRes.text();
                        const supervisor = JSON.parse(supervisorText) as {
                          errcode: number;
                          result?: { name?: string; nick?: string };
                        };
                        const supervisorName = supervisor.result?.name ?? supervisor.result?.nick;
                        if (supervisor.errcode === 0 && supervisorName) {
                          profile.supervisorName = supervisorName;
                          console.info('[dingtalk] direct supervisor synchronized');
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // 非关键
      }
    }

    if (!profile.unionId) {
      console.error('[dingtalk] No unionId in users/me');
      return loginErrorRedirect(request, 'dingtalk_token');
    }

    // 第 3 步：查找或创建用户（以 unionId 为唯一标识）
    const existing = await findDingTalkUser(profile.unionId);
    let user: { id: string; username: string; platformRole: string; role: string };

    if (existing) {
      if (existing.status !== 'active') {
        return loginErrorRedirect(request, 'dingtalk_disabled');
      }
      await syncDingTalkUser(existing.id, profile);
      user = existing;
    } else {
      user = await createDingTalkUser(profile);
    }

    // 直接使用钉钉职位名称绑定岗位，不存在则自动创建
    if (profile.title) {
      const roleId = await ensurePositionRole(profile.title);
      if (roleId) {
        await bindUserPosition(user.id, roleId);
        console.log('[dingtalk] Bound position from title:', profile.title);
      }
    }

    // 第 4 步：签发 session
    await createSession({
      id: user.id,
      username: user.username,
      platformRole: user.platformRole,
      role: user.role,
    });

    const returnTo = resolveReturnPath(jar.get(AUTH_RETURN_COOKIE)?.value, DEFAULT_AFTER_LOGIN);
    jar.set(AUTH_RETURN_COOKIE, '', {
      httpOnly: true,
      secure: defaultSecureCookie(),
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return NextResponse.redirect(getRequestUrl(request, returnTo), { status: 303 });
  } catch (err) {
    console.error('[dingtalk] Unexpected callback error:', err);
    return loginErrorRedirect(request, 'dingtalk');
  }
}
