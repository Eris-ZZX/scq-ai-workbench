import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilePlus2, FolderKanban, Heart, LayoutGrid, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { getSession } from '@/platform/auth/auth.config';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import '@/modules/ai-resources/ui/styles.css';

export default async function AiResourcesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const actor = await requireAiResourceUser();

  return (
    <div className="ai-resources-portal shell">
      <header className="topbar">
        <Link className="brand" href="/ai-resources/favorites">
          <span className="brand-mark">AI</span>
          <span>供应链质量部AI资源库</span>
        </Link>
        <nav className="nav">
          <Link href="/ai-resources/favorites">
            <Heart size={14} />
            我的收藏
          </Link>
          <Link href="/ai-resources/library">
            <FolderKanban size={14} />
            资源库
          </Link>
          <Link href="/ai-resources/new">
            <FilePlus2 size={14} />
            上传资源
          </Link>
          <Link href="/ai-resources/review">
            <ShieldCheck size={14} />
            审批
          </Link>
          {actor.isEffectiveAdmin ? (
            <Link href="/ai-resources/admin">
              <Settings size={14} />
              管理后台
            </Link>
          ) : null}
          <span className="nav-user">{session.username}</span>
          <Link href="/portal">
            <LayoutGrid size={14} />
            应用选择
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit">
              <LogOut size={14} />
              退出登录
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
