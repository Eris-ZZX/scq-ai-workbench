import Link from 'next/link';
import {
  Boxes,
  Bot,
  Code2,
  FileQuestion,
  FileText,
  GitBranch,
  Globe2,
  Library,
  Lightbulb,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { resourceTypeLabel } from '@/modules/ai-resources/labels';

const items: Array<{
  type: AiResourceType | '';
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { type: '', label: '全部资源', icon: Library },
  { type: 'APP', label: resourceTypeLabel.APP, icon: Boxes },
  { type: 'AGENT', label: resourceTypeLabel.AGENT, icon: Bot },
  { type: 'SKILL', label: resourceTypeLabel.SKILL, icon: Sparkles },
  { type: 'MCP', label: resourceTypeLabel.MCP, icon: Code2 },
  { type: 'WEB_PAGE', label: resourceTypeLabel.WEB_PAGE, icon: Globe2 },
  { type: 'CASE', label: resourceTypeLabel.CASE, icon: Lightbulb },
  { type: 'PROMPT', label: resourceTypeLabel.PROMPT, icon: MessageSquareText },
  { type: 'STANDARD_DOC', label: resourceTypeLabel.STANDARD_DOC, icon: FileText },
  { type: 'WORKFLOW', label: resourceTypeLabel.WORKFLOW, icon: GitBranch },
  { type: 'OTHER', label: resourceTypeLabel.OTHER, icon: FileQuestion },
];

export function ResourceSidebar({
  currentType,
  counts,
  q,
  tag,
  sort,
}: {
  currentType?: string;
  counts: Partial<Record<AiResourceType, number>>;
  q?: string;
  tag?: string;
  sort?: string;
}) {
  return (
    <aside className="resource-sidebar" aria-label="资源专区">
      <h2>资源专区</h2>
      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = (currentType ?? '') === item.type;
          const href = buildHref(item.type, q, tag, sort);
          const count = item.type
            ? (counts[item.type] ?? 0)
            : Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);

          return (
            <Link className={active ? 'sidebar-link active' : 'sidebar-link'} href={href} key={item.type || 'all'}>
              <span>
                <Icon size={16} />
                {item.label}
              </span>
              <strong>{count}</strong>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function buildHref(type: string, q?: string, tag?: string, sort?: string) {
  const next = new URLSearchParams();
  if (type) next.set('type', type);
  if (q?.trim()) next.set('q', q.trim());
  if (tag?.trim()) next.set('tag', tag.trim());
  if (sort && sort !== 'views') next.set('sort', sort);
  const query = next.toString();
  return query ? `/ai-resources/library?${query}` : '/ai-resources/library';
}
