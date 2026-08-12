import { db } from '@/lib/database';
import { platformApps } from './apps/manifest';

const PLATFORM_PROGRESS_SETTING_KEY = 'platform.development.progress';

const PLATFORM_DEVELOPMENT_ITEMS = [
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

export type PlatformDevelopmentItem = {
  id: string;
  title: string;
  description: string;
  state: 'active' | 'coming-soon';
  progressPercent: number;
  owner: DevelopmentProgressOwner | null;
  note: string | null;
};

export type PlatformDevelopmentSetting = {
  id: string;
  title: string;
  description: string;
  state: 'active' | 'coming-soon';
  progressPercent: number;
  ownerId: string | null;
  note: string;
};

export type DevelopmentProgressData = {
  platform: PlatformDevelopmentItem[];
};

type StoredProgressItem = {
  progressPercent?: unknown;
  ownerId?: unknown;
  note?: unknown;
};

type StoredProgressConfig = Record<string, StoredProgressItem>;

function clampPercent(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function defaultProgress(state: PlatformDevelopmentItem['state']) {
  return state === 'active' ? 100 : 0;
}

async function readPlatformProgressConfig(): Promise<StoredProgressConfig> {
  const setting = await db.appSetting.findUnique({
    where: { key: PLATFORM_PROGRESS_SETTING_KEY },
    select: { value: true },
  });
  if (!setting) return {};

  try {
    const parsed = JSON.parse(setting.value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredProgressConfig;
  } catch {
    return {};
  }
}

async function findOwners(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, DevelopmentProgressOwner>();
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
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
  const config = await readPlatformProgressConfig();
  const ownerIds = PLATFORM_DEVELOPMENT_ITEMS
    .map((item) => config[item.id]?.ownerId)
    .filter((ownerId): ownerId is string => typeof ownerId === 'string' && ownerId.length > 0);
  const ownerMap = await findOwners(Array.from(new Set(ownerIds)));

  return {
    platform: PLATFORM_DEVELOPMENT_ITEMS.map((item) => {
      const stored = config[item.id];
      const ownerId = typeof stored?.ownerId === 'string' ? stored.ownerId : null;
      return {
        ...item,
        progressPercent: clampPercent(stored?.progressPercent, defaultProgress(item.state)),
        owner: ownerId ? ownerMap.get(ownerId) ?? null : null,
        note: cleanText(stored?.note) || null,
      };
    }),
  };
}

export async function getPlatformDevelopmentSettings() {
  const config = await readPlatformProgressConfig();
  const users = await db.user.findMany({
    where: { status: 'active' },
    orderBy: { username: 'asc' },
    select: { id: true, username: true, displayName: true },
  });

  return {
    items: PLATFORM_DEVELOPMENT_ITEMS.map((item) => {
      const stored = config[item.id];
      return {
        ...item,
        progressPercent: clampPercent(stored?.progressPercent, defaultProgress(item.state)),
        ownerId: typeof stored?.ownerId === 'string' ? stored.ownerId : null,
        note: cleanText(stored?.note),
      };
    }),
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    })),
  };
}

export async function savePlatformDevelopmentSettings(
  items: Array<{ id: string; progressPercent: unknown; ownerId?: unknown; note?: unknown }>,
  updatedById: string,
) {
  const validItemIds = new Set(PLATFORM_DEVELOPMENT_ITEMS.map((item) => item.id));
  const users = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true },
  });
  const validUserIds = new Set(users.map((user) => user.id));
  const current = await readPlatformProgressConfig();
  const nextConfig: StoredProgressConfig = { ...current };

  for (const item of items) {
    if (!validItemIds.has(item.id)) throw new Error('INVALID_PLATFORM_PROGRESS_ITEM');
    const ownerId = cleanText(item.ownerId);
    if (ownerId && !validUserIds.has(ownerId)) throw new Error('INVALID_PLATFORM_PROGRESS_OWNER');
    nextConfig[item.id] = {
      progressPercent: clampPercent(item.progressPercent, 0),
      ownerId: ownerId || null,
      note: cleanText(item.note).slice(0, 500),
    };
  }

  await db.appSetting.upsert({
    where: { key: PLATFORM_PROGRESS_SETTING_KEY },
    create: {
      key: PLATFORM_PROGRESS_SETTING_KEY,
      value: JSON.stringify(nextConfig),
      updatedById,
    },
    update: {
      value: JSON.stringify(nextConfig),
      updatedById,
      updatedAt: new Date(),
    },
  });

  return getPlatformDevelopmentSettings();
}
