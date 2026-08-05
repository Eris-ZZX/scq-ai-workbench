import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireSystemAdminApi,
  getDirectorySyncStatus,
  getLatestExternalJob,
  enqueueExternalJob,
} = vi.hoisted(() => ({
  requireSystemAdminApi: vi.fn(),
  getDirectorySyncStatus: vi.fn(),
  getLatestExternalJob: vi.fn(),
  enqueueExternalJob: vi.fn(),
}));

vi.mock('@/platform/permissions/system-admin', () => ({ requireSystemAdminApi }));
vi.mock('@/lib/dws/directory-sync', () => ({ getDirectorySyncStatus }));
vi.mock('@/lib/external-jobs', () => ({
  getLatestExternalJob,
  enqueueExternalJob,
}));

import { GET, POST } from '@/app/api/admin/platform-users/organization/route';

describe('platform organization directory admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSystemAdminApi.mockResolvedValue({
      session: { sub: 'admin-1', username: 'admin', role: 'admin', platformRole: 'admin' },
    });
    getDirectorySyncStatus.mockResolvedValue({ status: 'idle', startedAt: '' });
    getLatestExternalJob.mockResolvedValue(null);
    enqueueExternalJob.mockResolvedValue({
      id: 'job-1',
      status: 'pending',
      kind: 'directory.sync',
    });
  });

  it('returns the last directory snapshot status and latest job', async () => {
    getDirectorySyncStatus.mockResolvedValue({ status: 'success', startedAt: '', matchedUserCount: 8 });
    getLatestExternalJob.mockResolvedValue({ id: 'job-1', status: 'succeeded' });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: { status: 'success', startedAt: '', matchedUserCount: 8 },
      job: { id: 'job-1', status: 'succeeded' },
    });
  });

  it('queues one protected directory synchronization for the Worker', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      status: 'queued',
      jobId: 'job-1',
    });
    expect(enqueueExternalJob).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'directory.sync',
      payload: { actorId: 'admin-1', actorUsername: 'admin' },
    }));
  });

  it('rejects a second synchronization while a job is active', async () => {
    getLatestExternalJob.mockResolvedValue({ id: 'job-1', status: 'processing' });

    const response = await POST();

    expect(response.status).toBe(409);
    expect(enqueueExternalJob).not.toHaveBeenCalled();
  });

  it('rejects non-platform administrators', async () => {
    requireSystemAdminApi.mockResolvedValue({
      error: '需要平台管理员权限',
      status: 403,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '需要平台管理员权限' });
    expect(enqueueExternalJob).not.toHaveBeenCalled();
  });
});
