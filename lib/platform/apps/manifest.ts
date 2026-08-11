import {
  Boxes,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Gauge,
  Library,
  Settings2,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type PlatformAppState = 'active' | 'coming-soon';
export type PlatformAppAccess = 'authenticated' | 'platform-admin';

export type PlatformApp = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  state: PlatformAppState;
  access: PlatformAppAccess;
};

export const platformApps = [
  {
    id: 'ai-resources',
    href: '/ai-resources',
    title: 'AI 资源库',
    description: '部门 AI 应用、Agent、Skill、Prompt 与规范目录',
    icon: Library,
    state: 'active',
    access: 'authenticated',
  },
  {
    id: 'npq',
    href: '/workbench',
    title: 'NPQ工作台',
    description: '项目活动、待办与 NPQ 流程管理（测试）',
    icon: FolderKanban,
    state: 'active',
    access: 'authenticated',
  },
  {
    id: 'pqm',
    href: '/portal/coming-soon/pqm',
    title: 'PQM',
    description: '应用功能正在搭建中',
    icon: ClipboardCheck,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'sqm',
    href: '/portal/coming-soon/sqm',
    title: 'SQM',
    description: '应用功能正在搭建中',
    icon: Gauge,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'qcm',
    href: '/portal/coming-soon/qcm',
    title: 'QCM',
    description: '应用功能正在搭建中',
    icon: Wrench,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'lab',
    href: '/portal/coming-soon/lab',
    title: '实验室',
    description: '应用功能正在搭建中',
    icon: FlaskConical,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'ems',
    href: '/portal/coming-soon/ems',
    title: 'EMS',
    description: '应用功能正在搭建中',
    icon: Boxes,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'management',
    href: '/portal/coming-soon/management',
    title: '管理工作台',
    description: '应用功能正在搭建中',
    icon: Settings2,
    state: 'coming-soon',
    access: 'authenticated',
  },
  {
    id: 'platform-admin',
    href: '/portal/platform-admin',
    title: '平台后台管理',
    description: '统一维护平台用户、权限和组织映射',
    icon: ShieldCheck,
    state: 'active',
    access: 'platform-admin',
  },
] as const satisfies readonly PlatformApp[];

export function getPlatformApp(appId: string) {
  return platformApps.find((app) => app.id === appId);
}

export function canAccessPlatformApp(app: PlatformApp, isPlatformAdmin: boolean) {
  return app.access !== 'platform-admin' || isPlatformAdmin;
}

export function getPortalApps(isPlatformAdmin: boolean) {
  return platformApps.filter((app) => canAccessPlatformApp(app, isPlatformAdmin));
}
