import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export function PortalAppCard({
  href,
  icon: Icon,
  title,
  description,
  compact = false,
  external = false,
  disabled = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
  external?: boolean;
  disabled?: boolean;
}) {
  const className = compact
    ? 'block rounded-md border border-border bg-white p-3 shadow-sm transition hover:border-primary'
    : 'block rounded-md border border-border bg-white p-4 shadow-sm transition hover:border-primary';
  const content = (
    <>
      <div className={compact
        ? 'mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary'
        : 'mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary'}>
        <Icon className="h-4 w-4" />
      </div>
      <div className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-foreground`}>{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </>
  );

  if (disabled) {
    return (
      <div className={`${className} cursor-not-allowed opacity-60`} aria-disabled="true">
        {content}
      </div>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
