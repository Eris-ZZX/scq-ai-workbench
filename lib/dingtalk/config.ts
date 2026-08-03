import 'dotenv/config';
import { sanitizeReturnPath } from '@/platform/auth/return-path';

export function getDingTalkAppCredentials() {
  const appKey = process.env.DINGTALK_CLIENT_ID?.trim();
  const appSecret = process.env.DINGTALK_CLIENT_SECRET?.trim();
  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
}

export function getDingTalkAgentId(): number | null {
  const raw = process.env.DINGTALK_AGENT_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getAppBaseUrl(): string | null {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export function buildAppUrl(path: string): string | null {
  const base = getAppBaseUrl();
  if (!base) return null;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

/**
 * HTTPS entry that restores session (or DingTalk SSO) then lands on target.
 */
export function buildAuthEntryUrl(path: string): string | null {
  const base = getAppBaseUrl();
  if (!base) return null;
  const safe = sanitizeReturnPath(path);
  if (!safe) return null;
  const params = new URLSearchParams({ next: safe });
  return `${base}/api/auth/entry?${params.toString()}`;
}

/**
 * Force DingTalk PC client to open the URL in the system browser
 * instead of the in-app side panel / workbench container.
 * @see https://open.dingtalk.com/document/isvapp/unified-routing-protocol
 */
export function buildDingTalkPcBrowserUrl(httpsUrl: string): string {
  return `dingtalk://dingtalkclient/page/link?url=${encodeURIComponent(httpsUrl)}&pc_slide=false`;
}

/** PC: system browser; App: HTTPS entry (in-app WebView + SSO). */
export function buildNotifyLinks(path: string): { pcUrl: string; appUrl: string } | null {
  const appUrl = buildAuthEntryUrl(path);
  if (!appUrl) return null;
  return {
    appUrl,
    pcUrl: buildDingTalkPcBrowserUrl(appUrl),
  };
}

export function dingtalkNotifyEnvStatus() {
  return {
    hasCredentials: Boolean(getDingTalkAppCredentials()),
    hasAgentId: Boolean(getDingTalkAgentId()),
    hasAppBaseUrl: Boolean(getAppBaseUrl()),
  };
}

export type DingTalkNotifyEnvStatus = ReturnType<typeof dingtalkNotifyEnvStatus>;
