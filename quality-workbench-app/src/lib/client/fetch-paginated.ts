'use client';

/** Load every page from a paginated JSON API that returns `{ items, totalPages }`. */
export async function fetchAllPaginatedItems<T>(
  url: string,
  pageSize = 50,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const join = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${join}page=${page}&pageSize=${pageSize}`);
    if (!response.ok) {
      throw new Error(`加载失败（${response.status}）`);
    }
    const data = (await response.json()) as { items?: T[]; totalPages?: number } | T[];
    if (Array.isArray(data)) {
      return data;
    }
    const chunk = data.items ?? [];
    items.push(...chunk);
    totalPages = Math.max(1, data.totalPages ?? 1);
    page += 1;
  } while (page <= totalPages);

  return items;
}
