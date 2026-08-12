import { randomUUID } from 'node:crypto';
import { db } from '@/lib/database';
import {
  canAccessPlatformApp,
  platformApps,
  resolvePlatformAppIcon,
  type PlatformApp,
  type PlatformAppAccess,
  type PlatformAppIconKey,
  type PlatformAppRecord,
  type PlatformAppState,
} from './manifest';

export const PLATFORM_APP_REGISTRY_SETTING_KEY = 'platform.apps.registry';

type StoredAppRegistry = {
  apps?: unknown;
};

export type PlatformAppRegistryInput = {
  id?: unknown;
  parentId?: unknown;
  href?: unknown;
  title?: unknown;
  description?: unknown;
  iconKey?: unknown;
  state?: unknown;
  access?: unknown;
  sortOrder?: unknown;
};

export type PlatformAppGroup = {
  app: PlatformApp;
  children: PlatformApp[];
};

const DEFAULT_APP_RECORDS: PlatformAppRecord[] = platformApps.map((app) => ({
  id: app.id,
  parentId: app.parentId,
  href: app.href,
  title: app.title,
  description: app.description,
  iconKey: app.iconKey,
  state: app.state,
  access: app.access,
  sortOrder: app.sortOrder,
  builtin: true,
}));

const DEFAULT_APP_IDS = new Set(DEFAULT_APP_RECORDS.map((app) => app.id));
const APP_ICON_KEYS = new Set<PlatformAppIconKey>([
  'boxes',
  'clipboard-check',
  'flask-conical',
  'folder-kanban',
  'gauge',
  'library',
  'settings',
  'shield-check',
  'wrench',
]);

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSortOrder(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function isPlatformAppState(value: unknown): value is PlatformAppState {
  return value === 'active' || value === 'coming-soon';
}

function isPlatformAppAccess(value: unknown): value is PlatformAppAccess {
  return value === 'authenticated' || value === 'platform-admin';
}

function isPlatformAppIconKey(value: unknown): value is PlatformAppIconKey {
  return typeof value === 'string' && APP_ICON_KEYS.has(value as PlatformAppIconKey);
}

function parseStoredApp(value: unknown): PlatformAppRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = cleanText(raw.id);
  const href = cleanText(raw.href);
  const title = cleanText(raw.title);
  const iconKey = raw.iconKey;
  const state = raw.state;
  const access = raw.access;

  if (
    !id
    || !href
    || !title
    || !isPlatformAppIconKey(iconKey)
    || !isPlatformAppState(state)
    || !isPlatformAppAccess(access)
  ) {
    return null;
  }

  return {
    id,
    parentId: cleanText(raw.parentId) || null,
    href,
    title,
    description: cleanText(raw.description),
    iconKey,
    state,
    access,
    sortOrder: parseSortOrder(raw.sortOrder),
    builtin: raw.builtin === true,
  };
}

async function readStoredAppRecords() {
  let setting: { value: string } | null;
  try {
    setting = await db.appSetting.findUnique({
      where: { key: PLATFORM_APP_REGISTRY_SETTING_KEY },
      select: { value: true },
    });
  } catch {
    return null;
  }
  if (!setting) return null;

  try {
    const parsed = JSON.parse(setting.value) as StoredAppRegistry;
    if (!Array.isArray(parsed?.apps)) return null;
    return parsed.apps
      .map(parseStoredApp)
      .filter((app): app is PlatformAppRecord => app !== null);
  } catch {
    return null;
  }
}

function sortRecords(records: PlatformAppRecord[]) {
  return [...records].sort((a, b) => (
    a.sortOrder - b.sortOrder
    || a.title.localeCompare(b.title, 'zh-CN')
  ));
}

function mergeWithDefaults(stored: PlatformAppRecord[] | null) {
  if (!stored) return sortRecords(DEFAULT_APP_RECORDS);

  const storedById = new Map(stored.map((app) => [app.id, app]));
  const records = DEFAULT_APP_RECORDS.map((defaultApp) => {
    const override = storedById.get(defaultApp.id);
    return {
      ...defaultApp,
      ...(override ?? {}),
      id: defaultApp.id,
      builtin: true,
    };
  });

  for (const app of stored) {
    if (!DEFAULT_APP_IDS.has(app.id) && !app.builtin) {
      records.push(app);
    }
  }

  const merged = sortRecords(records);
  try {
    validateRelationships(merged);
    return merged;
  } catch {
    return sortRecords(DEFAULT_APP_RECORDS);
  }
}

function resolveApp(record: PlatformAppRecord): PlatformApp {
  return {
    ...record,
    icon: resolvePlatformAppIcon(record.iconKey),
  };
}

export async function getPlatformAppRecords() {
  return mergeWithDefaults(await readStoredAppRecords());
}

export async function getPlatformApps() {
  const records = await getPlatformAppRecords();
  return records.map(resolveApp);
}

export async function getPlatformApp(appId: string) {
  const apps = await getPlatformApps();
  return apps.find((app) => app.id === appId);
}

export async function getPortalApps(isPlatformAdmin: boolean) {
  const apps = await getPlatformApps();
  return apps.filter((app) => canAccessPlatformApp(app, isPlatformAdmin));
}

export async function getPortalAppGroups(isPlatformAdmin: boolean): Promise<PlatformAppGroup[]> {
  const apps = await getPortalApps(isPlatformAdmin);
  const visibleIds = new Set(apps.map((app) => app.id));
  const roots = apps.filter((app) => !app.parentId || !visibleIds.has(app.parentId));

  return roots.map((app) => ({
    app,
    children: apps.filter((child) => child.parentId === app.id),
  }));
}

function normalizeInput(item: PlatformAppRegistryInput): PlatformAppRecord {
  const id = cleanText(item.id) || `custom-${randomUUID()}`;
  const parentId = cleanText(item.parentId) || null;
  const href = cleanText(item.href);
  const title = cleanText(item.title);
  const description = cleanText(item.description);
  const iconKey = item.iconKey;
  const state = item.state;
  const access = item.access;
  const sortOrder = parseSortOrder(item.sortOrder);

  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) {
    throw new Error('INVALID_PLATFORM_APP_ID');
  }
  if (!href.startsWith('/') || href.length > 300) {
    throw new Error('INVALID_PLATFORM_APP_HREF');
  }
  if (!title || title.length > 100) {
    throw new Error('INVALID_PLATFORM_APP_TITLE');
  }
  if (description.length > 500) {
    throw new Error('INVALID_PLATFORM_APP_DESCRIPTION');
  }
  if (!isPlatformAppIconKey(iconKey)) {
    throw new Error('INVALID_PLATFORM_APP_ICON');
  }
  if (!isPlatformAppState(state)) {
    throw new Error('INVALID_PLATFORM_APP_STATE');
  }
  if (!isPlatformAppAccess(access)) {
    throw new Error('INVALID_PLATFORM_APP_ACCESS');
  }

  return {
    id,
    parentId,
    href,
    title,
    description,
    iconKey,
    state,
    access,
    sortOrder,
    builtin: DEFAULT_APP_IDS.has(id),
  };
}

function validateRelationships(records: PlatformAppRecord[]) {
  const byId = new Map(records.map((app) => [app.id, app]));
  const hrefs = new Set<string>();

  for (const app of records) {
    if (hrefs.has(app.href)) throw new Error('DUPLICATE_PLATFORM_APP_HREF');
    hrefs.add(app.href);

    if (!app.parentId) continue;
    if (app.parentId === app.id || !byId.has(app.parentId)) {
      throw new Error('INVALID_PLATFORM_APP_PARENT');
    }
    if (byId.get(app.parentId)?.parentId) {
      throw new Error('NESTED_PLATFORM_APP');
    }
    if (records.some((candidate) => candidate.parentId === app.id)) {
      throw new Error('NESTED_PLATFORM_APP');
    }
  }
}

export async function getPlatformAppSettings() {
  return { apps: await getPlatformAppRecords() };
}

export async function savePlatformAppSettings(
  items: PlatformAppRegistryInput[],
  updatedById: string,
) {
  const nextById = new Map<string, PlatformAppRecord>();

  for (const item of items) {
    const app = normalizeInput(item);
    if (nextById.has(app.id)) throw new Error('DUPLICATE_PLATFORM_APP_ID');
    nextById.set(app.id, app);
  }

  const nextRecords = DEFAULT_APP_RECORDS.map((defaultApp) => (
    nextById.get(defaultApp.id) ?? defaultApp
  ));

  for (const app of nextById.values()) {
    if (!DEFAULT_APP_IDS.has(app.id)) nextRecords.push({ ...app, builtin: false });
  }

  validateRelationships(nextRecords);

  await db.appSetting.upsert({
    where: { key: PLATFORM_APP_REGISTRY_SETTING_KEY },
    create: {
      key: PLATFORM_APP_REGISTRY_SETTING_KEY,
      value: JSON.stringify({ apps: sortRecords(nextRecords) }),
      updatedById,
    },
    update: {
      value: JSON.stringify({ apps: sortRecords(nextRecords) }),
      updatedById,
      updatedAt: new Date(),
    },
  });

  return getPlatformAppSettings();
}
