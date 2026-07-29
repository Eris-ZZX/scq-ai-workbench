'use client';

import { ExternalLink } from 'lucide-react';
import { parseResourceLinks, type ResourceLinkItem } from '@/modules/ai-resources/resource-links';

export function QuickLinks({
  resourceUrl,
  links,
}: {
  resourceUrl?: string | null;
  links?: ResourceLinkItem[];
}) {
  const items = links ?? parseResourceLinks(resourceUrl);
  if (!items.length) return null;

  return (
    <div className="quick-links">
      {items.map((link, index) => (
        <span
          className="link-pill"
          role="link"
          tabIndex={0}
          key={`${index}-${link.label}-${link.url}`}
          title={`打开 ${link.label}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
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
          <span className="link-pill-label">{link.label}</span>
        </span>
      ))}
    </div>
  );
}
