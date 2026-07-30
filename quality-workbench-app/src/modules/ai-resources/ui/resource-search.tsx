'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const SORT_OPTIONS = [
  { value: 'views', label: '按浏览量' },
  { value: 'likes', label: '按点赞量' },
  { value: 'favorites', label: '按收藏量' },
] as const;

export function ResourceSearch({ tags }: { tags: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const [sort, setSort] = useState(params.get('sort') || 'views');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const type = params.get('type') ?? '';

  function pushParams(nextQ = q, nextTag = tag, nextSort = sort) {
    const next = new URLSearchParams();
    if (type) next.set('type', type);
    if (nextQ.trim()) next.set('q', nextQ.trim());
    if (nextTag.trim()) next.set('tag', nextTag.trim());
    if (nextSort && nextSort !== 'views') next.set('sort', nextSort);
    router.push(`/ai-resources/library?${next.toString()}`);
  }

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushParams(q, tag, sort), 300);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    pushParams(q, tag, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  useEffect(() => {
    pushParams(q, tag, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    setQ(params.get('q') ?? '');
    setTag(params.get('tag') ?? '');
    setSort(params.get('sort') || 'views');
  }, [params]);

  return (
    <div className="toolbar">
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="搜索名称、使用说明、实现方法、负责人"
      />
      <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="快捷标签筛选">
        <option value="">全部小组</option>
        {tags.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(event) => setSort(event.target.value)}
        aria-label="排序方式"
        className="toolbar-sort"
      >
        {SORT_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <Search size={16} />
    </div>
  );
}
