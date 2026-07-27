import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Inter } from 'next/font/google';
import { FilePlus2, FolderKanban, Heart, LayoutGrid, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { getSession } from '@/platform/auth/auth.config';
import { isAiResourcesEnabled } from '@/modules/ai-resources/config';
import { requireAiResourceUser } from '@/modules/ai-resources/guards';
import '@/modules/ai-resources/ui/styles.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default async function AiResourcesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!isAiResourcesEnabled()) {
    return (
      <div className={`ai-resources-portal shell ${inter.className}`}>
        <main className="main" style={{ textAlign: 'center', paddingTop: 80 }}>
          <h1>AI 资源库未启用</h1>
          <p className="subtle">请完成数据迁移并将 AI_RESOURCES_ENABLED 设为 true 后再访问。</p>
          <Link className="button primary" href="/portal" style={{ marginTop: 16 }}>
            返回应用选择
          </Link>
        </main>
      </div>
    );
  }

  const actor = await requireAiResourceUser();

  return (
    <div className={`ai-resources-portal shell ${inter.className}`}>
      <header className="topbar">
        <Link className="brand" href="/ai-resources">
          <span className="brand-mark">AI</span>
          <span>供应链质量部AI资源库</span>
        </Link>
        <nav className="nav">
          <Link href="/ai-resources/favorites">
            <Heart size={16} />
            我的收藏
          </Link>
          <Link href="/ai-resources">
            <FolderKanban size={16} />
            资源库
          </Link>
          <Link href="/ai-resources/new">
            <FilePlus2 size={16} />
            上传资源
          </Link>
          <Link href="/ai-resources/review">
            <ShieldCheck size={16} />
            审批
          </Link>
          {actor.isEffectiveAdmin ? (
            <Link href="/ai-resources/admin">
              <Settings size={16} />
              管理后台
            </Link>
          ) : null}
          <span className="nav-user">{session.username}</span>
          <Link href="/portal">
            <LayoutGrid size={16} />
            应用选择
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit">
              <LogOut size={16} />
              退出登录
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
