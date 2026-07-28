'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Folders, GripVertical, Heart, ListOrdered } from 'lucide-react';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { AI_RESOURCE_TYPES, isAiResourceType } from '@/modules/ai-resources/constants';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';
import { parseResourceLinks } from '@/modules/ai-resources/resource-links';
import { QuickLinks } from '@/modules/ai-resources/ui/quick-links';

export type FavoriteCardItem = {
  favoriteId: string;
  id: string;
  name: string;
  type: string;
  summary: string;
  resourceUrl?: string | null;
};

type ViewMode = 'custom' | 'category';

const VIEW_STORAGE_KEY = 'ai-resources-favorites-view';

export function FavoritesBoard({ initialItems }: { initialItems: FavoriteCardItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>('custom');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'custom' || saved === 'category') setViewMode(saved);
  }, []);

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
    setDragIndex(null);
    setOverIndex(null);
  }

  const persistOrder = useCallback((next: FavoriteCardItem[]) => {
    startTransition(async () => {
      setMessage('');
      const res = await fetch('/api/ai-resources/favorites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedResourceIds: next.map((item) => item.id) }),
      });
      if (!res.ok) {
        setMessage('排序保存失败，请刷新后重试');
      }
    });
  }, []);

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    persistOrder(next);
  }

  function unfavorite(resourceId: string) {
    startTransition(async () => {
      const prev = items;
      setItems((current) => current.filter((item) => item.id !== resourceId));
      const res = await fetch('/api/ai-resources/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId }),
      });
      if (!res.ok) {
        setItems(prev);
        setMessage('取消收藏失败');
      }
    });
  }

  const categorized = useMemo(() => {
    const groups = new Map<string, FavoriteCardItem[]>();
    for (const item of items) {
      const key = isAiResourceType(item.type) ? item.type : 'OTHER';
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return AI_RESOURCE_TYPES.filter((type) => (groups.get(type)?.length ?? 0) > 0).map((type) => ({
      type,
      label: resourceTypeLabel[type],
      items: groups.get(type)!,
    }));
  }, [items]);

  if (!items.length) {
    return (
      <div className="empty">
        你还没有收藏过资源。浏览资源库并点击 <Heart size={14} style={{ verticalAlign: 'middle' }} />{' '}
        图标即可收藏。
      </div>
    );
  }

  return (
    <div className="favorites-board">
      <div className="favorites-board-toolbar">
        <div className="favorites-view-switch" role="tablist" aria-label="收藏视图">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'custom'}
            className={`favorites-view-btn${viewMode === 'custom' ? ' is-active' : ''}`}
            onClick={() => switchView('custom')}
          >
            <ListOrdered size={14} />
            自定义排序
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'category'}
            className={`favorites-view-btn${viewMode === 'category' ? ' is-active' : ''}`}
            onClick={() => switchView('category')}
          >
            <Folders size={14} />
            分类视图
          </button>
        </div>
        <div className="favorites-board-meta">
          <span>共 {items.length} 个收藏</span>
          {message ? <span className="favorites-board-error">{message}</span> : null}
          {pending ? <span className="subtle">保存中…</span> : null}
        </div>
      </div>

      {viewMode === 'custom' ? (
        <div className="favorites-grid">
          {items.map((item, index) => (
            <FavoriteCard
              key={item.favoriteId}
              item={item}
              sortable
              dragging={dragIndex === index}
              dropTarget={overIndex === index && dragIndex !== null && dragIndex !== index}
              onUnfavorite={unfavorite}
              onDragOver={() => {
                if (dragIndex !== null) setOverIndex(index);
              }}
              onDrop={() => {
                if (dragIndex !== null) moveItem(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="favorites-category-list">
          {categorized.map((group) => (
            <section key={group.type} className="favorites-category-group">
              <header className="favorites-category-head">
                <h2>{group.label}</h2>
                <span>{group.items.length}</span>
              </header>
              <div className="favorites-grid">
                {group.items.map((item) => (
                  <FavoriteCard key={item.favoriteId} item={item} onUnfavorite={unfavorite} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoriteCard({
  item,
  sortable = false,
  dragging = false,
  dropTarget = false,
  onUnfavorite,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
}: {
  item: FavoriteCardItem;
  sortable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onUnfavorite: (resourceId: string) => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const links = parseResourceLinks(item.resourceUrl).slice(0, 3);
  const summary = item.summary.trim();

  return (
    <article
      className={`favorite-card${sortable ? '' : ' is-static'}${dragging ? ' is-dragging' : ''}${
        dropTarget ? ' is-over' : ''
      }`}
      onDragOver={
        sortable
          ? (event) => {
              event.preventDefault();
              onDragOver?.();
            }
          : undefined
      }
      onDrop={
        sortable
          ? (event) => {
              event.preventDefault();
              onDrop?.();
            }
          : undefined
      }
    >
      {sortable ? (
        <button
          type="button"
          className="favorite-card-handle"
          draggable
          title="拖动排序"
          aria-label={`拖动排序 ${item.name}`}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            onDragStart?.();
          }}
          onDragEnd={() => onDragEnd?.()}
        >
          <GripVertical size={16} />
        </button>
      ) : null}

      <div className="favorite-card-body">
        <div className="favorite-card-top">
          <span className="badge primary">
            {resourceTypeLabel[item.type as AiResourceType] ?? item.type}
          </span>
          <button
            type="button"
            className="engagement-toggle engagement-toggle-active favorite"
            title="取消收藏"
            aria-label="取消收藏"
            onClick={() => onUnfavorite(item.id)}
          >
            <Heart size={15} fill="currentColor" />
          </button>
        </div>

        <Link className="favorite-card-title" href={`/ai-resources/${item.id}`}>
          {item.name}
        </Link>

        <p className={`favorite-card-summary${summary ? '' : ' is-empty'}`}>
          {summary || '暂无使用说明'}
        </p>

        {links.length ? (
          <div className="favorite-card-links">
            <QuickLinks links={links} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
