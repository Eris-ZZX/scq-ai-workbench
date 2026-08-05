'use client';

import { useEffect } from 'react';

export function recordResourceView(resourceId: string) {
  void fetch(`/api/ai-resources/resources/${resourceId}/view`, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
  });
}

export function ViewTracker({ resourceId }: { resourceId: string }) {
  useEffect(() => {
    const key = `rv_${resourceId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordResourceView(resourceId);
  }, [resourceId]);

  return null;
}
