'use client';

import { ExternalLink, FolderOpen } from 'lucide-react';
import { recordResourceView } from '@/modules/ai-resources/ui/view-tracker';

type ResourceViewLinkProps = {
  href: string;
  resourceId: string;
  label: string;
  className: string;
  title?: string;
  icon?: 'external' | 'folder';
};

export function ResourceViewLink({
  href,
  resourceId,
  label,
  className,
  title,
  icon = 'external',
}: ResourceViewLinkProps) {
  const Icon = icon === 'folder' ? FolderOpen : ExternalLink;

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={() => recordResourceView(resourceId)}
    >
      <Icon size={icon === 'folder' ? 14 : 16} />
      <span>{label}</span>
    </a>
  );
}
