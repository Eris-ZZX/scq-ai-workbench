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
export type PlatformAppLaunchMode = 'internal' | 'external-link' | 'external-sso';

export type PlatformAppIconKey =
  | 'boxes'
  | 'clipboard-check'
  | 'flask-conical'
  | 'folder-kanban'
  | 'gauge'
  | 'library'
  | 'settings'
  | 'shield-check'
  | 'wrench';

export type PlatformAppRecord = {
  id: string;
  parentId: string | null;
  href: string;
  title: string;
  description: string;
  iconKey: PlatformAppIconKey;
  state: PlatformAppState;
  access: PlatformAppAccess;
  launchMode: PlatformAppLaunchMode;
  sortOrder: number;
  builtin: boolean;
};

export type PlatformApp = {
  id: string;
  parentId: string | null;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconKey: PlatformAppIconKey;
  state: PlatformAppState;
  access: PlatformAppAccess;
  launchMode: PlatformAppLaunchMode;
  sortOrder: number;
  builtin: boolean;
};

export const platformApps = [
  {
    id: 'ai-resources',
    parentId: null,
    href: '/ai-resources',
    title: 'AI 资源库',
    description: '部门 AI 应用、Agent、Skill、Prompt 与规范目录',
    icon: Library,
    iconKey: 'library',
    state: 'active',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 10,
    builtin: true,
  },
  {
    id: 'npq',
    parentId: null,
    href: '/workbench',
    title: 'NPQ工作台',
    description: '项目活动、待办与 NPQ 流程管理（测试）',
    icon: FolderKanban,
    iconKey: 'folder-kanban',
    state: 'active',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 20,
    builtin: true,
  },
  {
    id: 'pqm',
    parentId: null,
    href: '/portal/coming-soon/pqm',
    title: 'PQM',
    description: '应用功能正在搭建中',
    icon: ClipboardCheck,
    iconKey: 'clipboard-check',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 30,
    builtin: true,
  },
  {
    id: 'sqm',
    parentId: null,
    href: '/portal/coming-soon/sqm',
    title: 'SQM',
    description: '应用功能正在搭建中',
    icon: Gauge,
    iconKey: 'gauge',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 40,
    builtin: true,
  },
  {
    id: 'sqm-drawing-reliability',
    parentId: 'sqm',
    href: '/sqm/drawing-reliability',
    title: '图纸可靠性匹配',
    description: '从图纸提取可靠性要求并匹配测试基准库',
    icon: ClipboardCheck,
    iconKey: 'clipboard-check',
    state: 'active',
    access: 'authenticated',
    launchMode: 'external-sso',
    sortOrder: 41,
    builtin: true,
  },
  {
    id: 'qcm',
    parentId: null,
    href: '/portal/coming-soon/qcm',
    title: 'QCM',
    description: '应用功能正在搭建中',
    icon: Wrench,
    iconKey: 'wrench',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 50,
    builtin: true,
  },
  {
    id: 'lab',
    parentId: null,
    href: '/portal/coming-soon/lab',
    title: '实验室',
    description: '应用功能正在搭建中',
    icon: FlaskConical,
    iconKey: 'flask-conical',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 60,
    builtin: true,
  },
  {
    id: 'ems',
    parentId: null,
    href: '/portal/coming-soon/ems',
    title: 'EMS',
    description: '应用功能正在搭建中',
    icon: Boxes,
    iconKey: 'boxes',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 70,
    builtin: true,
  },
  {
    id: 'management',
    parentId: null,
    href: '/portal/coming-soon/management',
    title: '管理工作台',
    description: '应用功能正在搭建中',
    icon: Settings2,
    iconKey: 'settings',
    state: 'coming-soon',
    access: 'authenticated',
    launchMode: 'internal',
    sortOrder: 80,
    builtin: true,
  },
  {
    id: 'platform-admin',
    parentId: null,
    href: '/portal/platform-admin',
    title: '平台后台管理',
    description: '统一维护平台用户、权限和组织映射',
    icon: ShieldCheck,
    iconKey: 'shield-check',
    state: 'active',
    access: 'platform-admin',
    launchMode: 'internal',
    sortOrder: 90,
    builtin: true,
  },
] as const satisfies readonly PlatformApp[];

const PLATFORM_APP_ICONS: Record<PlatformAppIconKey, LucideIcon> = {
  boxes: Boxes,
  'clipboard-check': ClipboardCheck,
  'flask-conical': FlaskConical,
  'folder-kanban': FolderKanban,
  gauge: Gauge,
  library: Library,
  settings: Settings2,
  'shield-check': ShieldCheck,
  wrench: Wrench,
};

export function resolvePlatformAppIcon(iconKey: PlatformAppIconKey) {
  return PLATFORM_APP_ICONS[iconKey];
}

export function canAccessPlatformApp(app: PlatformApp, isPlatformAdmin: boolean) {
  return app.access !== 'platform-admin' || isPlatformAdmin;
}
