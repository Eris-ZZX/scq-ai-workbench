import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  heartbeat: vi.fn(),
  submitted: vi.fn(),
  resolved: vi.fn(),
  rework: vi.fn(),
  broadcast: vi.fn(),
  testNotification: vi.fn(),
}));

vi.mock('@/lib/external-jobs', () => ({
  claimExternalJobs: mocks.claim,
  markExternalJobSucceeded: mocks.succeed,
  markExternalJobFailed: mocks.fail,
  retryDelayForAttempt: () => 5_000,
}));
vi.mock('@/lib/dws/status', () => ({ recordDwsWorkerHeartbeat: mocks.heartbeat }));
vi.mock('@/lib/dws/directory-sync', () => ({
  syncDwsDirectory: vi.fn(),
  DwsDirectorySyncError: class DwsDirectorySyncError extends Error {
    retryable = true;
  },
}));
vi.mock('@/lib/dws/notifications', () => ({
  processReviewSubmitted: mocks.submitted,
  processReviewResolved: mocks.resolved,
  processReworkHandled: mocks.rework,
  processResourceBroadcast: mocks.broadcast,
  processTestNotification: mocks.testNotification,
  DwsNotificationError: class DwsNotificationError extends Error {
    retryable = true;
  },
}));
vi.mock('@/lib/dingtalk/notify-review', () => ({
  onResourcePublishedNotify: vi.fn(),
}));

import { runDwsWorkerOnce } from '@/lib/dws/worker';

const job = {
  id: 'job-1',
  kind: 'notification.review.submitted',
  payload: { reviewId: 'review-1' },
  attempts: 1,
};

describe('DWS worker state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DWS_MAX_ATTEMPTS;
  });

  it('marks a successfully processed job as succeeded', async () => {
    mocks.claim.mockResolvedValueOnce([job]);
    mocks.submitted.mockResolvedValueOnce({ taskId: 'todo-1' });

    const result = await runDwsWorkerOnce({ workerId: 'worker-1' });

    expect(result).toMatchObject({ workerId: 'worker-1', claimed: 1 });
    expect(mocks.submitted).toHaveBeenCalledWith('review-1', 'job-1', expect.anything());
    expect(mocks.succeed).toHaveBeenCalledWith('job-1', 'worker-1', { result: { taskId: 'todo-1' } });
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(mocks.heartbeat).toHaveBeenCalledWith({
      workerId: 'worker-1',
      pendingJobs: 1,
      failedJobs: 0,
    });
  });

  it('makes retryable failures visible and schedules another attempt', async () => {
    mocks.claim.mockResolvedValueOnce([job]);
    mocks.submitted.mockRejectedValueOnce(Object.assign(new Error('DWS temporarily unavailable'), {
      retryable: true,
    }));

    const result = await runDwsWorkerOnce({ workerId: 'worker-1' });

    expect(result.results).toEqual([{
      id: 'job-1',
      status: 'retrying',
      error: 'DWS temporarily unavailable',
    }]);
    expect(mocks.fail).toHaveBeenCalledWith(expect.objectContaining({
      id: 'job-1',
      workerId: 'worker-1',
      retryable: true,
      retryAt: expect.any(Date),
    }));
    expect(mocks.succeed).not.toHaveBeenCalled();
  });
});
