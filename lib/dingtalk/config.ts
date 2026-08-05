import { sanitizeReturnPath } from '@/platform/auth/return-path';

/**
 * Legacy compatibility helpers. DingTalk credentials are intentionally not
 * read anymore; all new external work is executed by the DWS Worker.
 */
export function getDingTalkAppCredentials(): null {
  return null;
}

export function getDingTalkAgentId(): null {
  return null;
}

export function getAppBaseUrl() {
  const raw = process.env.APP_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

export function buildAppUrl(path: string) {
  const base = getAppBaseUrl();
  if (!base) return null;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildAuthEntryUrl(path: string) {
  const base = getAppBaseUrl();
  const safe = sanitizeReturnPath(path);
  if (!base || !safe) return null;
  return `${base}/api/auth/entry?next=${encodeURIComponent(safe)}`;
}

/** @deprecated ActionCard links are no longer emitted. */
export function buildDingTalkPcBrowserUrl(httpsUrl: string) {
  return httpsUrl;
}

export function buildNotifyLinks(path: string) {
  const appUrl = buildAuthEntryUrl(path);
  return appUrl ? { pcUrl: appUrl, appUrl } : null;
}

export function dingtalkNotifyEnvStatus() {
  return {
    hasCredentials: false,
    hasAgentId: false,
    hasAppBaseUrl: Boolean(getAppBaseUrl()),
  };
}

export type DingTalkNotifyEnvStatus = ReturnType<typeof dingtalkNotifyEnvStatus>;
