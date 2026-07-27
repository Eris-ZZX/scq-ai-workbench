'use client';

import { Heart } from 'lucide-react';
import { useCallback, useState } from 'react';

export function FavoriteToggle({
  resourceId,
  initialFavorited = false,
}: {
  resourceId: string;
  initialFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;
      setPending(true);
      const next = !favorited;
      setFavorited(next);
      try {
        const res = await fetch('/api/ai-resources/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId }),
        });
        if (!res.ok) setFavorited(!next);
      } catch {
        setFavorited(!next);
      } finally {
        setPending(false);
      }
    },
    [resourceId, favorited, pending],
  );

  return (
    <button
      className="favorite-toggle"
      onClick={toggle}
      aria-label={favorited ? '取消收藏' : '收藏'}
      title={favorited ? '取消收藏' : '收藏'}
      type="button"
    >
      <Heart
        size={16}
        fill={favorited ? 'currentColor' : 'none'}
        className={favorited ? 'favorite-toggle-active' : ''}
      />
    </button>
  );
}
