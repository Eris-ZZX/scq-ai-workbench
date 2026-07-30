import Link from 'next/link';

export function AdminPager({
  page,
  totalPages,
  total,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  if (total <= 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        共 {total} 条 · 第 {page}/{totalPages} 页
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className="rounded border border-border bg-white px-3 py-1.5 text-foreground hover:border-ws-blue"
            href={hrefForPage(page - 1)}
          >
            上一页
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            className="rounded border border-border bg-white px-3 py-1.5 text-foreground hover:border-ws-blue"
            href={hrefForPage(page + 1)}
          >
            下一页
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ClientPager({
  page,
  totalPages,
  total,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (total <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        共 {total} 条 · 第 {page}/{totalPages} 页
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-border bg-white px-3 py-1.5 text-foreground hover:border-ws-blue disabled:opacity-50"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </button>
        <button
          type="button"
          className="rounded border border-border bg-white px-3 py-1.5 text-foreground hover:border-ws-blue disabled:opacity-50"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
