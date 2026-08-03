export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_LOG_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function readParam(params: SearchParamsLike, key: string): string | null {
  if (!params) return null;
  if (params instanceof URLSearchParams) return params.get(key);
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parsePagination(
  params: SearchParamsLike,
  options?: { pageSize?: number; maxPageSize?: number },
) {
  const pageSizeDefault = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE;
  const page = Math.max(1, Number(readParam(params, 'page')) || 1);
  const rawSize = Number(readParam(params, 'pageSize')) || pageSizeDefault;
  const pageSize = Math.min(maxPageSize, Math.max(1, rawSize));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  return {
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    items,
    ...paginationMeta(total, page, pageSize),
  };
}
