import { randomUUID } from 'node:crypto';
import { db } from '@/lib/database';
import { platformApps } from './apps/manifest';

const PLATFORM_PROJECTS_SETTING_KEY = 'platform.development.projects';

const PLATFORM_DEVELOPMENT_CATEGORIES = [
  {
    id: 'platform-core',
    title: '平台基础设施',
    description: '统一身份、权限、应用入口和通知基础能力',
    state: 'active' as const,
  },
  ...platformApps.map((app) => ({
    id: app.id,
    title: app.title,
    description: app.description,
    state: app.state,
  })),
];

export type DevelopmentProgressOwner = {
  id: string;
  username: string;
  displayName: string;
};

export type DevelopmentProgressCategory = {
  id: string;
  title: string;
  description: string;
  state: 'active' | 'coming-soon';
};

export type DevelopmentProgressProject = {
  id: string;
  categoryId: string;
  name: string;
  progressPercent: number;
  owner: DevelopmentProgressOwner | null;
  note: string | null;
};

export type DevelopmentProgressData = {
  categories: DevelopmentProgressCategory[];
  projects: DevelopmentProgressProject[];
};

export type PlatformDevelopmentProjectSetting = {
  id: string;
  categoryId: string;
  name: string;
  progressPercent: number;
  ownerId: string | null;
  note: string;
};

type StoredProject = {
  id: string;
  categoryId: string;
  name: string;
  progressPercent?: unknown;
  ownerId?: unknown;
  note?: unknown;
};

type StoredProjectsConfig = {
  projects?: unknown;
};

const PLATFORM_DEVELOPMENT_CATEGORY_IDS = new Set(
  PLATFORM_DEVELOPMENT_CATEGORIES.map((category) => category.id),
);

function clampPercent(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function readPlatformProjects(): Promise<StoredProject[]> {
  const setting = await db.appSetting.findUnique({
    where: { key: PLATFORM_PROJECTS_SETTING_KEY },
    select: { value: true },
  });
  if (!setting) return [];

  try {
    const parsed = JSON.parse(setting.value) as StoredProjectsConfig;
    if (!Array.isArray(parsed?.projects)) return [];
    return parsed.projects.flatMap((project) => {
      if (!project || typeof project !== 'object') return [];
      const value = project as Record<string, unknown>;
      const id = cleanText(value.id);
      const categoryId = cleanText(value.categoryId);
      const name = cleanText(value.name);
      if (!id || !PLATFORM_DEVELOPMENT_CATEGORY_IDS.has(categoryId) || !name) return [];
      return [{
        id,
        categoryId,
        name,
        progressPercent: value.progressPercent,
        ownerId: value.ownerId,
        note: value.note,
      }];
    });
  } catch {
    return [];
  }
}

async function findOwners(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, DevelopmentProgressOwner>();
  const users = await db.user.findMany({
    where: { id: { in: userIds }, status: 'active' },
    select: { id: true, username: true, displayName: true },
  });
  return new Map(users.map((user) => [
    user.id,
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    },
  ]));
}

export async function getDevelopmentProgress(): Promise<DevelopmentProgressData> {
  const projects = await readPlatformProjects();
  const ownerIds = projects
    .map((project) => project.ownerId)
    .filter((ownerId): ownerId is string => typeof ownerId === 'string' && ownerId.length > 0);
  const ownerMap = await findOwners(Array.from(new Set(ownerIds)));

  return {
    categories: PLATFORM_DEVELOPMENT_CATEGORIES,
    projects: projects.map((project) => ({
      id: project.id,
      categoryId: project.categoryId,
      name: project.name,
      progressPercent: clampPercent(project.progressPercent, 0),
      owner: typeof project.ownerId === 'string'
        ? ownerMap.get(project.ownerId) ?? null
        : null,
      note: cleanText(project.note) || null,
    })),
  };
}

export async function getPlatformDevelopmentSettings() {
  const projects = await readPlatformProjects();
  const users = await db.user.findMany({
    where: { status: 'active' },
    orderBy: { username: 'asc' },
    select: { id: true, username: true, displayName: true },
  });

  return {
    categories: PLATFORM_DEVELOPMENT_CATEGORIES,
    projects: projects.map((project) => ({
      id: project.id,
      categoryId: project.categoryId,
      name: project.name,
      progressPercent: clampPercent(project.progressPercent, 0),
      ownerId: typeof project.ownerId === 'string' ? project.ownerId : null,
      note: cleanText(project.note),
    })),
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    })),
  };
}

export async function savePlatformDevelopmentSettings(
  items: Array<{
    id?: unknown;
    categoryId?: unknown;
    name?: unknown;
    progressPercent?: unknown;
    ownerId?: unknown;
    note?: unknown;
  }>,
  updatedById: string,
) {
  const validCategoryIds = new Set(PLATFORM_DEVELOPMENT_CATEGORIES.map((category) => category.id));
  const users = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true },
  });
  const validUserIds = new Set(users.map((user) => user.id));
  const seenIds = new Set<string>();
  const nextProjects: StoredProject[] = [];

  for (const item of items) {
    const id = cleanText(item.id) || randomUUID();
    const categoryId = cleanText(item.categoryId);
    const name = cleanText(item.name);
    if (!validCategoryIds.has(categoryId)) throw new Error('INVALID_PLATFORM_PROGRESS_CATEGORY');
    if (!name) throw new Error('EMPTY_PLATFORM_PROGRESS_PROJECT');
    if (seenIds.has(id)) throw new Error('DUPLICATE_PLATFORM_PROGRESS_PROJECT');
    seenIds.add(id);
    const ownerId = cleanText(item.ownerId);
    if (ownerId && !validUserIds.has(ownerId)) throw new Error('INVALID_PLATFORM_PROGRESS_OWNER');
    nextProjects.push({
      id,
      categoryId,
      name: name.slice(0, 200),
      progressPercent: clampPercent(item.progressPercent, 0),
      ownerId: ownerId || null,
      note: cleanText(item.note).slice(0, 500),
    });
  }

  await db.appSetting.upsert({
    where: { key: PLATFORM_PROJECTS_SETTING_KEY },
    create: {
      key: PLATFORM_PROJECTS_SETTING_KEY,
      value: JSON.stringify({ projects: nextProjects }),
      updatedById,
    },
    update: {
      value: JSON.stringify({ projects: nextProjects }),
      updatedById,
      updatedAt: new Date(),
    },
  });

  return getPlatformDevelopmentSettings();
}
