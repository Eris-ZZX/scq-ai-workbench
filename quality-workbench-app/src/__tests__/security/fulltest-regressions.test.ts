import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockJson, mockGetEvents, mockGetUsageStats, mockPrisma } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    data,
    status: (init as { status?: number })?.status ?? 200,
  })),
  mockGetEvents: vi.fn(),
  mockGetUsageStats: vi.fn(),
  mockPrisma: {
    project: { findFirst: vi.fn() },
    projectPositionAssignment: { findMany: vi.fn() },
    userPosition: { findUnique: vi.fn() },
    npqActionPermission: { findFirst: vi.fn() },
    notification: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/platform/auth/auth.config', () => ({ getSession: mockGetSession }));
vi.mock('@/platform/observability', () => ({ getEvents: mockGetEvents }));
vi.mock('@/platform/observability/metrics', () => ({ getUsageStats: mockGetUsageStats }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { GET as getObservability } from '@/app/api/admin/observability/route';
import { PATCH as patchMyTodos } from '@/app/api/npq/my-todos/route';
import { canExecuteNpqAction } from '@/lib/db/npq-permissions';

describe('full-test security regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires project access before checking NPQ project-scoped permissions', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    const allowed = await canExecuteNpqAction({
      actionKey: 'stage_gate.pass',
      session: { sub: 'user-1', role: 'user' },
      projectId: 'project-1',
    });

    expect(allowed).toBe(false);
    expect(mockPrisma.npqActionPermission.findFirst).not.toHaveBeenCalled();
  });

  it('allows project-scoped permissions only after project access and action permission match', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce({ id: 'project-1' });
    mockPrisma.projectPositionAssignment.findMany.mockResolvedValueOnce([{ positionRoleId: 'pos-npq' }]);
    mockPrisma.userPosition.findUnique.mockResolvedValueOnce({ positionRoleId: 'pos-npq' });
    mockPrisma.npqActionPermission.findFirst.mockResolvedValueOnce({ id: 'perm-1' });

    const allowed = await canExecuteNpqAction({
      actionKey: 'stage_gate.pass',
      session: { sub: 'user-1', role: 'user' },
      projectId: 'project-1',
    });

    expect(allowed).toBe(true);
    expect(mockPrisma.npqActionPermission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ actionKey: 'stage_gate.pass' }),
    }));
  });

  it('blocks non-admin users from observability events', async () => {
    mockGetSession.mockResolvedValueOnce({ sub: 'user-1', role: 'user' });

    const res = await getObservability(new Request('http://localhost/api/admin/observability'));

    expect(res.status).toBe(403);
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it('marks only the current user notification as read', async () => {
    mockGetSession.mockResolvedValueOnce({ sub: 'user-1', role: 'user' });
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await patchMyTodos({
      json: () => Promise.resolve({ notificationId: 'notice-1' }),
    } as unknown as Request);

    expect(res.status).toBe(200);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notice-1', recipientUserId: 'user-1' },
      data: { status: 'read', readAt: expect.any(Date) },
    });
  });

  it('returns 404 when marking another user notification as read', async () => {
    mockGetSession.mockResolvedValueOnce({ sub: 'user-1', role: 'user' });
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await patchMyTodos({
      json: () => Promise.resolve({ notificationId: 'notice-2' }),
    } as unknown as Request);

    expect(res.status).toBe(404);
  });
});
