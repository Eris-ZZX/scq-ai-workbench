'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Clock, Eye, Heart, ThumbsUp } from 'lucide-react';

type EngagementState = {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  currentVersion: number;
  pendingLike: boolean;
  pendingFavorite: boolean;
  toggleLike: (e: React.MouseEvent) => void;
  toggleFavorite: (e: React.MouseEvent) => void;
};

const EngagementContext = createContext<EngagementState | null>(null);

function useEngagement() {
  const value = useContext(EngagementContext);
  if (!value) throw new Error('ResourceEngagement components must be used within provider');
  return value;
}

export function ResourceEngagementProvider({
  resourceId,
  initialLiked = false,
  initialFavorited = false,
  initialLikeCount = 0,
  initialFavoriteCount = 0,
  viewCount,
  currentVersion,
  children,
}: {
  resourceId: string;
  initialLiked?: boolean;
  initialFavorited?: boolean;
  initialLikeCount?: number;
  initialFavoriteCount?: number;
  viewCount: number;
  currentVersion: number;
  children: React.ReactNode;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState(false);

  const toggleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pendingLike) return;
      setPendingLike(true);
      const next = !liked;
      setLiked(next);
      setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
      try {
        const res = await fetch('/api/ai-resources/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId }),
        });
        if (!res.ok) {
          setLiked(!next);
          setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
          return;
        }
        const data = (await res.json()) as { liked?: boolean; likeCount?: number };
        if (typeof data.liked === 'boolean') setLiked(data.liked);
        if (typeof data.likeCount === 'number') setLikeCount(data.likeCount);
      } catch {
        setLiked(!next);
        setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
      } finally {
        setPendingLike(false);
      }
    },
    [resourceId, liked, pendingLike],
  );

  const toggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pendingFavorite) return;
      setPendingFavorite(true);
      const next = !favorited;
      setFavorited(next);
      setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
      try {
        const res = await fetch('/api/ai-resources/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId }),
        });
        if (!res.ok) {
          setFavorited(!next);
          setFavoriteCount((count) => Math.max(0, count + (next ? -1 : 1)));
          return;
        }
        const data = (await res.json()) as { favorited?: boolean; favoriteCount?: number };
        if (typeof data.favorited === 'boolean') setFavorited(data.favorited);
        if (typeof data.favoriteCount === 'number') setFavoriteCount(data.favoriteCount);
      } catch {
        setFavorited(!next);
        setFavoriteCount((count) => Math.max(0, count + (next ? -1 : 1)));
      } finally {
        setPendingFavorite(false);
      }
    },
    [resourceId, favorited, pendingFavorite],
  );

  const value = useMemo(
    () => ({
      liked,
      favorited,
      likeCount,
      favoriteCount,
      viewCount,
      currentVersion,
      pendingLike,
      pendingFavorite,
      toggleLike,
      toggleFavorite,
    }),
    [
      liked,
      favorited,
      likeCount,
      favoriteCount,
      viewCount,
      currentVersion,
      pendingLike,
      pendingFavorite,
      toggleLike,
      toggleFavorite,
    ],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function ResourceEngagementToggles() {
  const { liked, favorited, pendingLike, pendingFavorite, toggleLike, toggleFavorite } = useEngagement();

  return (
    <div className="resource-card-toggles">
      <button
        className={`engagement-toggle${liked ? ' engagement-toggle-active like' : ''}`}
        onClick={toggleLike}
        aria-label={liked ? '取消点赞' : '点赞'}
        title={liked ? '取消点赞' : '点赞'}
        type="button"
        disabled={pendingLike}
      >
        <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
      </button>
      <button
        className={`engagement-toggle${favorited ? ' engagement-toggle-active favorite' : ''}`}
        onClick={toggleFavorite}
        aria-label={favorited ? '取消收藏' : '收藏'}
        title={favorited ? '取消收藏' : '收藏'}
        type="button"
        disabled={pendingFavorite}
      >
        <Heart size={16} fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

export function ResourceEngagementStats() {
  const { likeCount, favoriteCount, viewCount, currentVersion } = useEngagement();

  return (
    <div className="resource-card-stats">
      <span className="badge resource-card-stat" title="版本">
        <Clock size={13} />
        <span className="resource-card-stat-num">{formatStat(`v${currentVersion}`)}</span>
      </span>
      <span className="badge resource-card-stat" title="浏览量">
        <Eye size={13} />
        <span className="resource-card-stat-num">{formatStat(viewCount)}</span>
      </span>
      <span className="badge resource-card-stat" title="点赞数">
        <ThumbsUp size={13} />
        <span className="resource-card-stat-num">{formatStat(likeCount)}</span>
      </span>
      <span className="badge resource-card-stat" title="收藏数">
        <Heart size={13} />
        <span className="resource-card-stat-num">{formatStat(favoriteCount)}</span>
      </span>
    </div>
  );
}

function formatStat(value: number | string) {
  return String(value);
}
