import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDatabase } = vi.hoisted(() => ({
  mockDatabase: {
    appSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/database', () => ({ db: mockDatabase }));

import {
  getDevelopmentProgress,
  savePlatformDevelopmentSettings,
} from '@/lib/platform/development-progress';

describe('platform development progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.appSetting.findUnique.mockResolvedValue(null);
    mockDatabase.user.findMany.mockResolvedValue([]);
    mockDatabase.appSetting.upsert.mockResolvedValue({});
  });

  it('exposes platform infrastructure and every manifest app as categories', async () => {
    const result = await getDevelopmentProgress();

    expect(result.categories[0]).toMatchObject({
      id: 'platform-core',
      title: '平台基础设施',
    });
    expect(result.categories.some((item) => item.id === 'npq')).toBe(true);
    expect(result.projects).toEqual([]);
    expect(mockDatabase.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'platform.development.projects' },
      select: { value: true },
    });
  });

  it('does not convert the old fixed-item configuration into projects', async () => {
    mockDatabase.appSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ 'platform-core': { progressPercent: 80 } }),
    });

    const result = await getDevelopmentProgress();
    expect(result.projects).toEqual([]);
  });

  it('reads fine-grained projects with owner and note', async () => {
    mockDatabase.appSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        projects: [{
          id: 'project-1',
          categoryId: 'platform-core',
          name: '统一登录改造',
          progressPercent: 80,
          ownerId: 'user-1',
          note: '正在联调',
        }],
      }),
    });
    mockDatabase.user.findMany.mockResolvedValueOnce([
      { id: 'user-1', username: 'owner', displayName: '平台负责人' },
    ]);

    const result = await getDevelopmentProgress();
    expect(result.projects[0]).toMatchObject({
      id: 'project-1',
      categoryId: 'platform-core',
      name: '统一登录改造',
      progressPercent: 80,
      owner: { id: 'user-1', displayName: '平台负责人' },
      note: '正在联调',
    });
  });

  it('rejects an inactive platform progress owner', async () => {
    mockDatabase.user.findMany.mockResolvedValueOnce([]);

    await expect(savePlatformDevelopmentSettings([
      {
        id: 'project-1',
        categoryId: 'platform-core',
        name: '统一登录改造',
        progressPercent: 50,
        ownerId: 'disabled-user',
      },
    ], 'admin-1')).rejects.toThrow('INVALID_PLATFORM_PROGRESS_OWNER');
    expect(mockDatabase.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects a project with an invalid category', async () => {
    await expect(savePlatformDevelopmentSettings([
      {
        id: 'project-1',
        categoryId: 'unknown',
        name: '无效项目',
        progressPercent: 20,
      },
    ], 'admin-1')).rejects.toThrow('INVALID_PLATFORM_PROGRESS_CATEGORY');
    expect(mockDatabase.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects a project without a name', async () => {
    await expect(savePlatformDevelopmentSettings([
      {
        id: 'project-1',
        categoryId: 'platform-core',
        name: '   ',
        progressPercent: 20,
      },
    ], 'admin-1')).rejects.toThrow('EMPTY_PLATFORM_PROGRESS_PROJECT');
    expect(mockDatabase.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('replaces the project list when saving, allowing deletion', async () => {
    mockDatabase.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);

    await savePlatformDevelopmentSettings([], 'admin-1');

    expect(mockDatabase.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'platform.development.projects' },
      update: expect.objectContaining({
        value: JSON.stringify({ projects: [] }),
        updatedById: 'admin-1',
      }),
    }));
  });
});
