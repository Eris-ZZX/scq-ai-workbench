'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ExternalLink, Folders, GripVertical, Heart, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { AI_RESOURCE_TYPES, isAiResourceType } from '@/modules/ai-resources/constants';
import { hostedHtmlOpenPath, parseHostedHtml } from '@/modules/ai-resources/hosted-html';
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
  extension?: unknown;
  tagId?: string | null;
};

export type FavoriteTagItem = {
  id: string;
  name: string;
  sortOrder: number;
};

type ViewMode = 'custom' | 'category';

type DragCard = {
  kind: 'card';
  resourceId: string;
  fromTagId: string | null;
};

type DragTag = {
  kind: 'tag';
  tagId: string;
};

type DragState = DragCard | DragTag | null;

const VIEW_STORAGE_KEY = 'ai-resources-favorites-view';
const UNGROUPED_KEY = '__ungrouped__';
const PERSIST_DEBOUNCE_MS = 400;

export function FavoritesBoard({
  initialItems,
  initialTags,
}: {
  initialItems: FavoriteCardItem[];
  initialTags: FavoriteTagItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [tags, setTags] = useState(initialTags);
  const [viewMode, setViewMode] = useState<ViewMode>('custom');
  const [drag, setDrag] = useState<DragState>(null);
  const [overCardId, setOverCardId] = useState<string | null>(null);
  const [overTagId, setOverTagId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const groupsPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagsPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGroupsPayload = useRef<{
    groups: Array<{ tagId: string | null; resourceIds: string[] }>;
  } | null>(null);
  const pendingTagOrder = useRef<string[] | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'custom' || saved === 'category') setViewMode(saved);
  }, []);

  useEffect(() => {
    return () => {
      if (groupsPersistTimer.current) clearTimeout(groupsPersistTimer.current);
      if (tagsPersistTimer.current) clearTimeout(tagsPersistTimer.current);
    };
  }, []);

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
    clearDrag();
  }

  function clearDrag() {
    setDrag(null);
    setOverCardId(null);
    setOverTagId(null);
  }

  const taggedGroups = useMemo(() => {
    const byTag = new Map<string | null, FavoriteCardItem[]>();
    byTag.set(null, []);
    for (const tag of tags) byTag.set(tag.id, []);
    for (const item of items) {
      const key = item.tagId && byTag.has(item.tagId) ? item.tagId : null;
      byTag.get(key)!.push(item);
    }
    return {
      tags: tags.map((tag) => ({
        tag,
        items: byTag.get(tag.id) ?? [],
      })),
      ungrouped: byTag.get(null) ?? [],
    };
  }, [items, tags]);

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

  const persistGroups = useCallback((nextItems: FavoriteCardItem[], nextTags: FavoriteTagItem[]) => {
    const groups = [
      ...nextTags.map((tag) => ({
        tagId: tag.id as string | null,
        resourceIds: nextItems.filter((item) => item.tagId === tag.id).map((item) => item.id),
      })),
      {
        tagId: null,
        resourceIds: nextItems
          .filter((item) => !item.tagId || !nextTags.some((tag) => tag.id === item.tagId))
          .map((item) => item.id),
      },
    ];

    pendingGroupsPayload.current = { groups };
    if (groupsPersistTimer.current) clearTimeout(groupsPersistTimer.current);
    groupsPersistTimer.current = setTimeout(() => {
      const payload = pendingGroupsPayload.current;
      pendingGroupsPayload.current = null;
      if (!payload) return;
      startTransition(async () => {
        setMessage('');
        const res = await fetch('/api/ai-resources/favorites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) setMessage('分组保存失败，请刷新后重试');
      });
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const persistTagOrder = useCallback((nextTags: FavoriteTagItem[]) => {
    pendingTagOrder.current = nextTags.map((tag) => tag.id);
    if (tagsPersistTimer.current) clearTimeout(tagsPersistTimer.current);
    tagsPersistTimer.current = setTimeout(() => {
      const orderedTagIds = pendingTagOrder.current;
      pendingTagOrder.current = null;
      if (!orderedTagIds) return;
      startTransition(async () => {
        setMessage('');
        const res = await fetch('/api/ai-resources/favorite-tags', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedTagIds }),
        });
        if (!res.ok) setMessage('标签排序保存失败，请刷新后重试');
      });
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  function buildItemsAfterCardMove(
    resourceId: string,
    targetTagId: string | null,
    beforeResourceId: string | null,
  ) {
    const moving = items.find((item) => item.id === resourceId);
    if (!moving) return items;

    const without = items.filter((item) => item.id !== resourceId);
    const updated = { ...moving, tagId: targetTagId };
    const targetItems = without.filter((item) => (item.tagId ?? null) === targetTagId);
    let insertAt = targetItems.length;
    if (beforeResourceId) {
      const idx = targetItems.findIndex((item) => item.id === beforeResourceId);
      if (idx >= 0) insertAt = idx;
    }
    targetItems.splice(insertAt, 0, updated);

    return rebuildItemsByGroups(
      tags,
      [
        ...tags.map((tag) => ({
          tagId: tag.id as string | null,
          list:
            tag.id === targetTagId
              ? targetItems
              : without.filter((item) => item.tagId === tag.id),
        })),
        {
          tagId: null,
          list: targetTagId === null ? targetItems : without.filter((item) => !item.tagId),
        },
      ],
    );
  }

  function moveCard(resourceId: string, targetTagId: string | null, beforeResourceId: string | null) {
    const nextItems = buildItemsAfterCardMove(resourceId, targetTagId, beforeResourceId);
    setItems(nextItems);
    persistGroups(nextItems, tags);
  }

  function moveTag(fromId: string, beforeId: string | null) {
    const fromIndex = tags.findIndex((tag) => tag.id === fromId);
    if (fromIndex < 0) return;
    const next = [...tags];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    let toIndex = next.length;
    if (beforeId) {
      const idx = next.findIndex((tag) => tag.id === beforeId);
      if (idx >= 0) toIndex = idx;
    }
    next.splice(toIndex, 0, moved);
    const normalized = next.map((tag, index) => ({ ...tag, sortOrder: index }));
    setTags(normalized);
    persistTagOrder(normalized);
  }

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    startTransition(async () => {
      setMessage('');
      const res = await fetch('/api/ai-resources/favorite-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error || '创建标签失败');
        return;
      }
      const data = (await res.json()) as { tag: FavoriteTagItem };
      setTags((current) => [...current, data.tag]);
      setNewTagName('');
      setCreatingTag(false);
    });
  }

  function renameTag(id: string) {
    const name = editingTagName.trim();
    if (!name) return;
    startTransition(async () => {
      setMessage('');
      const res = await fetch('/api/ai-resources/favorite-tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error || '重命名失败');
        return;
      }
      const data = (await res.json()) as { tag: FavoriteTagItem };
      setTags((current) => current.map((tag) => (tag.id === id ? data.tag : tag)));
      setEditingTagId(null);
      setEditingTagName('');
    });
  }

  function deleteTag(id: string) {
    if (!window.confirm('删除该标签后，其中的收藏会回到「未分组」。确定删除？')) return;
    startTransition(async () => {
      setMessage('');
      const res = await fetch(`/api/ai-resources/favorite-tags?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setMessage('删除标签失败');
        return;
      }
      setTags((current) => current.filter((tag) => tag.id !== id));
      setItems((current) =>
        current.map((item) => (item.tagId === id ? { ...item, tagId: null } : item)),
      );
    });
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
        <div className="favorites-board-toolbar-left">
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

          {viewMode === 'custom' ? (
            creatingTag ? (
              <form
                className="favorites-tag-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  createTag();
                }}
              >
                <input
                  autoFocus
                  value={newTagName}
                  maxLength={20}
                  placeholder="标签名称"
                  onChange={(event) => setNewTagName(event.target.value)}
                />
                <button type="submit" disabled={!newTagName.trim() || pending}>
                  添加
                </button>
                <button
                  type="button"
                  className="favorites-tag-cancel"
                  onClick={() => {
                    setCreatingTag(false);
                    setNewTagName('');
                  }}
                >
                  取消
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="favorites-tag-add"
                title="拖拽卡片到标签分组，拖拽标签标题可调整标签顺序"
                onClick={() => setCreatingTag(true)}
              >
                <Plus size={14} />
                新建标签
              </button>
            )
          ) : null}
        </div>
        <div className="favorites-board-meta">
          <span>共 {items.length} 个收藏</span>
          {message ? <span className="favorites-board-error">{message}</span> : null}
          {pending ? <span className="subtle">保存中…</span> : null}
        </div>
      </div>

      {viewMode === 'custom' ? (
        <div className="favorites-tag-board">
          {taggedGroups.tags.map(({ tag, items: groupItems }) => (
            <TagGroupSection
              key={tag.id}
              tagId={tag.id}
              title={tag.name}
              count={groupItems.length}
              items={groupItems}
              sortable
              tagDraggable
              editing={editingTagId === tag.id}
              editingName={editingTagName}
              dropActive={
                (drag?.kind === 'card' && overTagId === tag.id && !overCardId) ||
                (drag?.kind === 'tag' && overTagId === tag.id && drag.tagId !== tag.id)
              }
              onEditStart={() => {
                setEditingTagId(tag.id);
                setEditingTagName(tag.name);
              }}
              onEditNameChange={setEditingTagName}
              onEditSave={() => renameTag(tag.id)}
              onEditCancel={() => {
                setEditingTagId(null);
                setEditingTagName('');
              }}
              onDelete={() => deleteTag(tag.id)}
              onTagDragStart={() => setDrag({ kind: 'tag', tagId: tag.id })}
              onTagDragEnd={clearDrag}
              onSectionDragOver={() => {
                if (!drag) return;
                if (drag.kind === 'card') {
                  setOverTagId(tag.id);
                  setOverCardId(null);
                } else if (drag.kind === 'tag' && drag.tagId !== tag.id) {
                  setOverTagId(tag.id);
                }
              }}
              onSectionDrop={() => {
                if (!drag) return;
                if (drag.kind === 'card') {
                  moveCard(drag.resourceId, tag.id, overCardId);
                } else if (drag.kind === 'tag') {
                  moveTag(drag.tagId, tag.id);
                }
                clearDrag();
              }}
              onUnfavorite={unfavorite}
              drag={drag}
              overCardId={overCardId}
              onCardDragStart={(resourceId) =>
                setDrag({ kind: 'card', resourceId, fromTagId: tag.id })
              }
              onCardDragOver={(resourceId) => {
                if (drag?.kind !== 'card') return;
                setOverTagId(tag.id);
                setOverCardId(resourceId);
              }}
              onCardDrop={(resourceId) => {
                if (drag?.kind !== 'card') return;
                moveCard(drag.resourceId, tag.id, resourceId);
                clearDrag();
              }}
              onCardDragEnd={clearDrag}
            />
          ))}

          <TagGroupSection
            tagId={null}
            title="未分组"
            count={taggedGroups.ungrouped.length}
            items={taggedGroups.ungrouped}
            sortable
            dropActive={drag?.kind === 'card' && overTagId === UNGROUPED_KEY && !overCardId}
            onSectionDragOver={() => {
              if (drag?.kind === 'card') {
                setOverTagId(UNGROUPED_KEY);
                setOverCardId(null);
              }
            }}
            onSectionDrop={() => {
              if (drag?.kind === 'card') {
                moveCard(drag.resourceId, null, overCardId);
              }
              clearDrag();
            }}
            onUnfavorite={unfavorite}
            drag={drag}
            overCardId={overCardId}
            onCardDragStart={(resourceId) =>
              setDrag({ kind: 'card', resourceId, fromTagId: null })
            }
            onCardDragOver={(resourceId) => {
              if (drag?.kind !== 'card') return;
              setOverTagId(UNGROUPED_KEY);
              setOverCardId(resourceId);
            }}
            onCardDrop={(resourceId) => {
              if (drag?.kind !== 'card') return;
              moveCard(drag.resourceId, null, resourceId);
              clearDrag();
            }}
            onCardDragEnd={clearDrag}
          />
        </div>
      ) : (
        <div className="favorites-category-list">
          {categorized.map((group) => (
            <section key={group.type} className="favorites-category-group">
              <header className="favorites-category-head">
                <div className="favorites-category-head-main">
                  <h2>{group.label}</h2>
                </div>
                <div className="favorites-category-head-meta">
                  <span>{group.items.length}</span>
                </div>
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

function rebuildItemsByGroups(
  tags: FavoriteTagItem[],
  groups: Array<{ tagId: string | null; list: FavoriteCardItem[] }>,
) {
  const next: FavoriteCardItem[] = [];
  for (const tag of tags) {
    const group = groups.find((item) => item.tagId === tag.id);
    if (group) next.push(...group.list);
  }
  const ungrouped = groups.find((item) => item.tagId === null);
  if (ungrouped) next.push(...ungrouped.list);
  return next;
}

function TagGroupSection({
  tagId,
  title,
  count,
  items,
  sortable = false,
  tagDraggable = false,
  editing = false,
  editingName = '',
  dropActive = false,
  onEditStart,
  onEditNameChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onTagDragStart,
  onTagDragEnd,
  onSectionDragOver,
  onSectionDrop,
  onUnfavorite,
  drag,
  overCardId,
  onCardDragStart,
  onCardDragOver,
  onCardDrop,
  onCardDragEnd,
}: {
  tagId: string | null;
  title: string;
  count: number;
  items: FavoriteCardItem[];
  sortable?: boolean;
  tagDraggable?: boolean;
  editing?: boolean;
  editingName?: string;
  dropActive?: boolean;
  onEditStart?: () => void;
  onEditNameChange?: (value: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  onDelete?: () => void;
  onTagDragStart?: () => void;
  onTagDragEnd?: () => void;
  onSectionDragOver?: () => void;
  onSectionDrop?: () => void;
  onUnfavorite: (resourceId: string) => void;
  drag: DragState;
  overCardId: string | null;
  onCardDragStart: (resourceId: string) => void;
  onCardDragOver: (resourceId: string) => void;
  onCardDrop: (resourceId: string) => void;
  onCardDragEnd: () => void;
}) {
  return (
    <section
      className={`favorites-category-group favorites-tag-group${dropActive ? ' is-over' : ''}`}
      onDragOver={
        sortable
          ? (event) => {
              event.preventDefault();
              onSectionDragOver?.();
            }
          : undefined
      }
      onDrop={
        sortable
          ? (event) => {
              event.preventDefault();
              onSectionDrop?.();
            }
          : undefined
      }
    >
      <header className="favorites-category-head">
        <div className="favorites-category-head-main">
          {tagDraggable ? (
            <button
              type="button"
              className="favorites-tag-handle"
              draggable
              title="拖动标签排序"
              aria-label={`拖动标签 ${title}`}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                onTagDragStart?.();
              }}
              onDragEnd={() => onTagDragEnd?.()}
            >
              <GripVertical size={14} />
            </button>
          ) : null}

          {editing ? (
            <form
              className="favorites-tag-edit"
              onSubmit={(event) => {
                event.preventDefault();
                onEditSave?.();
              }}
            >
              <input
                autoFocus
                value={editingName}
                maxLength={20}
                onChange={(event) => onEditNameChange?.(event.target.value)}
              />
              <button type="submit">保存</button>
              <button type="button" onClick={() => onEditCancel?.()}>
                取消
              </button>
            </form>
          ) : (
            <h2>{title}</h2>
          )}
        </div>

        <div className="favorites-category-head-meta">
          <span>{count}</span>
          {tagId ? (
            <div className="favorites-tag-actions">
              {!editing ? (
                <button type="button" title="重命名" aria-label="重命名" onClick={() => onEditStart?.()}>
                  <Pencil size={13} />
                </button>
              ) : null}
              <button type="button" title="删除标签" aria-label="删除标签" onClick={() => onDelete?.()}>
                <Trash2 size={13} />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {items.length ? (
        <div className="favorites-grid">
          {items.map((item) => (
            <FavoriteCard
              key={item.favoriteId}
              item={item}
              sortable={sortable}
              dragging={drag?.kind === 'card' && drag.resourceId === item.id}
              dropTarget={overCardId === item.id && drag?.kind === 'card' && drag.resourceId !== item.id}
              onUnfavorite={onUnfavorite}
              onDragOver={() => onCardDragOver(item.id)}
              onDrop={() => onCardDrop(item.id)}
              onDragStart={() => onCardDragStart(item.id)}
              onDragEnd={onCardDragEnd}
            />
          ))}
        </div>
      ) : (
        <div className="favorites-tag-empty">将收藏拖到这里</div>
      )}
    </section>
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
  const allLinks = parseResourceLinks(item.resourceUrl);
  const links = allLinks.slice(0, 2);
  const hasMoreLinks = allLinks.length > 2;
  const summary = item.summary.trim();
  const typeLabel = resourceTypeLabel[item.type as AiResourceType] ?? item.type;
  const openHref = parseHostedHtml(item.extension) ? hostedHtmlOpenPath(item.id) : null;

  return (
    <article
      className={`favorite-card${sortable ? ' is-sortable' : ''}${dragging ? ' is-dragging' : ''}${
        dropTarget ? ' is-over' : ''
      }`}
      onDragOver={
        sortable
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onDragOver?.();
            }
          : undefined
      }
      onDrop={
        sortable
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onDrop?.();
            }
          : undefined
      }
    >
      <Link
        className="favorite-card-cover"
        href={`/ai-resources/${item.id}`}
        aria-label={`查看 ${item.name}`}
      />

      <div className="favorite-card-head">
        <h3 className="favorite-card-title">{item.name}</h3>
        <button
          type="button"
          className="engagement-toggle engagement-toggle-active favorite favorite-card-heart"
          title="取消收藏"
          aria-label="取消收藏"
          onClick={() => onUnfavorite(item.id)}
        >
          <Heart size={13} fill="currentColor" />
        </button>
      </div>

      <p className={`favorite-card-summary${summary ? '' : ' is-empty'}`}>
        {summary || '暂无使用说明'}
      </p>

      <div className="favorite-card-foot">
        <span className="favorite-card-type">{typeLabel}</span>

        <div className="favorite-card-links">
          {openHref ? (
            <button
              type="button"
              className="link-pill favorite-card-open"
              title="打开托管 HTML 页面"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                window.open(openHref, '_blank', 'noopener,noreferrer');
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <ExternalLink size={12} />
              <span className="link-pill-label">打开</span>
            </button>
          ) : null}
          {links.length ? (
            <>
              <div className="favorite-card-links-actions">
                <QuickLinks links={links} />
              </div>
              {hasMoreLinks ? (
                <span className="favorite-card-links-ellipsis" aria-hidden>
                  …
                </span>
              ) : null}
            </>
          ) : null}
        </div>

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
            <GripVertical size={13} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
