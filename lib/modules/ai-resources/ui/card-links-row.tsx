'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { ResourceLinkItem } from '@/modules/ai-resources/resource-links';
import { QuickLinks } from '@/modules/ai-resources/ui/quick-links';

const GAP = 6;
const ELLIPSIS_WIDTH = 16;

/** 首页卡片链接行：只展示能完整放下的链接；有溢出时显示不可点击的省略号。 */
export function CardLinksRow({
  links,
  resourceId,
}: {
  links: ResourceLinkItem[];
  resourceId: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(links.length);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const update = () => {
      const available = row.clientWidth;
      const pills = Array.from(measure.querySelectorAll<HTMLElement>('.link-pill'));
      let used = 0;
      let count = 0;

      for (const pill of pills) {
        const width = pill.getBoundingClientRect().width;
        const next = count === 0 ? width : used + GAP + width;
        if (next > available + 0.5) break;
        used = next;
        count += 1;
      }

      // 有放不下的链接时，预留省略号宽度，必要时再少显示一个
      if (count < pills.length) {
        while (count > 0 && used + GAP + ELLIPSIS_WIDTH > available + 0.5) {
          count -= 1;
          used = 0;
          for (let i = 0; i < count; i += 1) {
            const pill = pills[i];
            if (!pill) break;
            const width = pill.getBoundingClientRect().width;
            used = i === 0 ? width : used + GAP + width;
          }
        }
      }

      setVisibleCount(count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [links]);

  const visible = links.slice(0, visibleCount);
  const hasMore = visibleCount < links.length;

  return (
    <div
      ref={rowRef}
      className="resource-card-clip-row"
      title={links.map((link) => link.label).join('、')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div ref={measureRef} className="resource-card-links-measure" aria-hidden>
        <QuickLinks links={links} resourceId={resourceId} />
      </div>
      {visible.length ? <QuickLinks links={visible} resourceId={resourceId} /> : null}
      {hasMore ? (
        <span className="resource-card-links-ellipsis" aria-hidden>
          …
        </span>
      ) : null}
    </div>
  );
}
