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

  it('includes platform infrastructure and every manifest app with sensible defaults', async () => {
    const result = await getDevelopmentProgress();

    expect(result.platform[0]).toMatchObject({
      id: 'platform-core',
      title: '平台基础设施',
      progressPercent: 100,
      owner: null,
    });
    expect(result.platform.some((item) => item.id === 'npq')).toBe(true);
    expect(result.platform.find((item) => item.id === 'pqm')?.progressPercent).toBe(0);
  });

  it('clamps saved progress and keeps owner and note settings', async () => {
    mockDatabase.appSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        'platform-core': {
          progressPercent: 120,
          ownerId: 'user-1',
          note: '平台能力持续优化',
        },
      }),
    });
    mockDatabase.user.findMany.mockResolvedValueOnce([
      { id: 'user-1', username: 'owner', displayName: '平台负责人' },
    ]);

    const result = await getDevelopmentProgress();
    expect(result.platform[0]).toMatchObject({
      progressPercent: 100,
      owner: { id: 'user-1', displayName: '平台负责人' },
      note: '平台能力持续优化',
    });
  });

  it('rejects an inactive platform progress owner', async () => {
    mockDatabase.user.findMany.mockResolvedValueOnce([]);

    await expect(savePlatformDevelopmentSettings([
      { id: 'platform-core', progressPercent: 50, ownerId: 'disabled-user' },
    ], 'admin-1')).rejects.toThrow('INVALID_PLATFORM_PROGRESS_OWNER');
    expect(mockDatabase.appSetting.upsert).not.toHaveBeenCalled();
  });
});
