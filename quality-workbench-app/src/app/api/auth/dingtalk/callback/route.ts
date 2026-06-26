// GET /api/auth/dingtalk/callback — 钉钉 OAuth2.0 回调
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession } from '@/platform/auth/auth.config';
import { getRequestUrl } from '@/platform/auth/request-url';
import {
  findDingTalkUser,
  createDingTalkUser,
  syncDingTalkUser,
  type DingTalkProfile,
} from '@/lib/db/dingtalk';

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
      secure: process.env.NODE_ENV === 'production',
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
      console.error('[dingtalk] userAccessToken HTTP', tokenRes.status, await tokenRes.text());
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
    console.log('[dingtalk] users/me:', JSON.stringify(meData));

    const profile: DingTalkProfile = {
      unionId: meData.unionId,
      nick: meData.nick || `dt_${(meData.unionId || meData.openId || 'user').slice(0, 8)}`,
      avatarUrl: meData.avatarUrl ?? undefined,
      email: meData.email ?? undefined,
    };

    if (!profile.unionId) {
      console.error('[dingtalk] No unionId in users/me');
      return loginErrorRedirect(request, 'dingtalk_token');
    }

    // 第 3 步：查找或创建用户（以 unionId 为唯一标识）
    const existing = await findDingTalkUser(profile.unionId);
    let user: { id: string; username: string; role: string };

    if (existing) {
      if (existing.status !== 'active') {
        return loginErrorRedirect(request, 'dingtalk_disabled');
      }
      // 每次登录同步最新档案
      await syncDingTalkUser(existing.id, profile);
      user = existing;
    } else {
      user = await createDingTalkUser(profile);
    }

    // 第 4 步：签发 session
    await createSession({ id: user.id, username: user.username, role: user.role });

    return NextResponse.redirect(getRequestUrl(request, '/workbench'), { status: 303 });
  } catch (err) {
    console.error('[dingtalk] Unexpected callback error:', err);
    return loginErrorRedirect(request, 'dingtalk');
  }
}
