import { fromJsonObject } from '@/modules/ai-resources/json';

export type HostedHtmlMeta = {
  storedName: string;
  originalName: string;
  size: number;
};

const HTML_EXT = /\.(html?|HTML?)$/;

export function isHtmlFileName(name: string) {
  return HTML_EXT.test(name.trim());
}

export function parseHostedHtml(extension: unknown): HostedHtmlMeta | null {
  const data =
    extension && typeof extension === 'object' && !Array.isArray(extension)
      ? (extension as Record<string, unknown>)
      : fromJsonObject(extension);

  const hosted = data.hostedHtml;
  if (!hosted || typeof hosted !== 'object' || Array.isArray(hosted)) return null;

  const storedName =
    typeof (hosted as { storedName?: unknown }).storedName === 'string'
      ? (hosted as { storedName: string }).storedName.trim()
      : '';
  const originalName =
    typeof (hosted as { originalName?: unknown }).originalName === 'string'
      ? (hosted as { originalName: string }).originalName.trim()
      : storedName;
  const size =
    typeof (hosted as { size?: unknown }).size === 'number' ? (hosted as { size: number }).size : 0;

  if (!storedName || storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    return null;
  }
  if (!isHtmlFileName(storedName) && !isHtmlFileName(originalName)) return null;

  return { storedName, originalName: originalName || storedName, size };
}

/** 托管 HTML 直链（新标签打开用，不再走站内 /open 预览页） */
export function hostedHtmlOpenPath(resourceId: string) {
  return `/api/ai-resources/resources/${resourceId}/html`;
}

export function buildExtensionWithHostedHtml(
  existing: unknown,
  hostedHtml: HostedHtmlMeta | null,
): Record<string, unknown> | null {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : fromJsonObject(existing);

  if (!hostedHtml) {
    if ('hostedHtml' in base) {
      const { hostedHtml: _removed, ...rest } = base;
      return Object.keys(rest).length ? rest : null;
    }
    return Object.keys(base).length ? base : null;
  }

  return {
    ...base,
    hostedHtml,
  };
}

export function storedNameFromUploadUrl(url: string) {
  const marker = '/api/ai-resources/files/';
  const index = url.indexOf(marker);
  if (index < 0) return '';
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '').trim();
}
