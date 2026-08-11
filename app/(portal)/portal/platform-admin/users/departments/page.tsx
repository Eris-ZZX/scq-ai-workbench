import Link from 'next/link';
import { ArrowLeft, ListTree } from 'lucide-react';
import { requireSystemAdminPage } from '@/platform/permissions/system-admin';
import PlatformDepartmentsPage from '../../../users/platform-departments-page';

export default async function PlatformDepartmentsPageRoute() {
  await requireSystemAdminPage('/portal/platform-admin/users/departments');

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="mb-6">
          <Link
            href="/portal/platform-admin/users"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            用户与权限管理
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <ListTree className="h-4 w-4" />
            Platform / Organization Mapping
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">组织小组 ID 映射管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            维护钉钉组织 ID 与中文名称的对应关系，导入后用户组织信息会直接使用这里的名称。
          </p>
        </header>
        <PlatformDepartmentsPage />
      </div>
    </div>
  );
}
