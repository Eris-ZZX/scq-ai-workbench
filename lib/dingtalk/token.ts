import { getDingTalkAppCredentials } from './config';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;

export async function getCorpAccessToken(): Promise<string | null> {
  const creds = getDingTalkAppCredentials();
  if (!creds) return null;

  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) {
    return cache.accessToken;
  }

  const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(creds.appKey)}&appsecret=${encodeURIComponent(creds.appSecret)}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    access_token?: string;
    expires_in?: number;
  };

  if (!res.ok || data.errcode !== 0 || !data.access_token) {
    console.error('[dingtalk] gettoken failed', {
      status: res.status,
      errcode: data.errcode ?? null,
      errmsg: data.errmsg ?? null,
    });
    return null;
  }

  const expiresInMs = Math.max(60, (data.expires_in ?? 7200) - 120) * 1000;
  cache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };
  return cache.accessToken;
}
