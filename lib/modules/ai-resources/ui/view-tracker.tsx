'use client';

import { useEffect } from 'react';

export function ViewTracker({ resourceId }: { resourceId: string }) {
  useEffect(() => {
    const key = `rv_${resourceId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void fetch(`/api/ai-resources/resources/${resourceId}/view`, {
      method: 'POST',
      credentials: 'same-origin',
    });
  }, [resourceId]);

  return null;
}
