const DINGTALK_DESKTOP_PATTERN = /\bDingTalk\b/i;
const MOBILE_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

export const BROWSER_HANDOFF_PARAM = 'browser';
export const BROWSER_HANDOFF_VALUE = '1';

/**
 * Detects the desktop DingTalk container without treating mobile DingTalk
 * clients as part of this PC-only browser handoff.
 */
export function isDingTalkDesktopUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return false;
  return DINGTALK_DESKTOP_PATTERN.test(userAgent) && !MOBILE_PATTERN.test(userAgent);
}

export function hasBrowserHandoff(rawUrl: string | URL) {
  const url = typeof rawUrl === 'string' ? new URL(rawUrl) : rawUrl;
  return url.searchParams.get(BROWSER_HANDOFF_PARAM) === BROWSER_HANDOFF_VALUE;
}

export function markBrowserHandoff(rawUrl: string | URL) {
  const url = typeof rawUrl === 'string' ? new URL(rawUrl) : new URL(rawUrl.toString());
  url.searchParams.set(BROWSER_HANDOFF_PARAM, BROWSER_HANDOFF_VALUE);
  return url.toString();
}

/**
 * Opens a URL in the DingTalk desktop browser container.
 * The target URL must be encoded as a single nested URL parameter.
 */
export function buildDingTalkBrowserUrl(targetUrl: string) {
  return `dingtalk://dingtalkclient/page/link?url=${encodeURIComponent(targetUrl)}&pc_slide=false`;
}
