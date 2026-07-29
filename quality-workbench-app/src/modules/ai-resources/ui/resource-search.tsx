'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function ResourceSearch({ tags }: { tags: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const type = params.get('type') ?? '';

  function pushParams(nextQ = q, nextTag = tag) {
    const next = new URLSearchParams();
    if (type) next.set('type', type);
    if (nextQ.trim()) next.set('q', nextQ.trim());
    if (nextTag.trim()) next.set('tag', nextTag.trim());
    router.push(`/ai-resources/library?${next.toString()}`);
  }

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushParams(q, tag), 300);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  useEffect(() => {
    pushParams(q, tag);
  }, [tag]);

  useEffect(() => {
    setQ(params.get('q') ?? '');
    setTag(params.get('tag') ?? '');
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
      <Search size={16} />
    </div>
  );
}
