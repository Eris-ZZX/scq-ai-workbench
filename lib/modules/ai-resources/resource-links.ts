export type ResourceLinkItem = { url: string; label: string };

export function parseResourceLinks(value?: string | null): ResourceLinkItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return value.trim() ? [{ url: value.trim(), label: linkLabelFromUrl(value.trim(), 0) }] : [];
    }
    return parsed
      .map((item, index) => {
        if (typeof item === 'string') {
          const url = item.trim();
          if (!url) return null;
          return { url, label: linkLabelFromUrl(url, index) };
        }
        if (item && typeof item === 'object' && 'url' in item) {
          const url = String((item as { url: unknown }).url).trim();
          if (!url) return null;
          const rawLabel = String((item as { label?: unknown }).label ?? '').trim();
          return { url, label: rawLabel || linkLabelFromUrl(url, index) };
        }
        return null;
      })
      .filter((item): item is ResourceLinkItem => !!item);
  } catch {
    const url = value.trim();
    return url ? [{ url, label: linkLabelFromUrl(url, 0) }] : [];
  }
}

function linkLabelFromUrl(url: string, index: number): string {
  try {
    if (/^https?:\/\//i.test(url)) {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host) return host;
    }
  } catch {
    /* ignore */
  }
  const fileName = url.split(/[\\/]/).filter(Boolean).pop();
  if (fileName && fileName !== url) return fileName;
  return `链接${index + 1}`;
}
