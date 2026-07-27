'use client';

import { ExternalLink } from 'lucide-react';

type NamedUrl = { url: string; label: string };

export function QuickLinks({ resourceUrl }: { resourceUrl?: string | null }) {
  const links = parseUrls(resourceUrl);
  if (!links.length) return null;

  return (
    <div className="quick-links">
      {links.map((link) => (
        <span
          className="link-pill"
          role="link"
          tabIndex={0}
          key={link.url}
          title={`打开 ${link.label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(link.url, '_blank', 'noopener,noreferrer');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              window.open(link.url, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <ExternalLink size={12} />
          {link.label}
        </span>
      ))}
    </div>
  );
}

function parseUrls(value?: string | null): NamedUrl[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (typeof item === 'string') {
          return { url: item.trim(), label: `链接${index + 1}` };
        }
        if (item && typeof item === 'object' && 'url' in item) {
          const url = String(item.url).trim();
          if (!url) return null;
          const rawLabel = String((item as Record<string, unknown>).label ?? '');
          const label = rawLabel.trim() || `链接${index + 1}`;
          return { url, label };
        }
        return null;
      })
      .filter((item): item is NamedUrl => !!item && !!item.url);
  } catch {
    return [];
  }
}
