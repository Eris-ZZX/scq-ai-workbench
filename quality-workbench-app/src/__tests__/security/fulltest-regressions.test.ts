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
    projectMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    projectPositionAssignment: { findMany: vi.fn() },
    userPosition: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/platform/auth/auth.config', () => ({ getSession: mockGetSession }));
vi.mock('@/platform/observability', () => ({ getEvents: mockGetEvents }));
vi.mock('@/platform/observability/metrics', () => ({ getUsageStats: mockGetUsageStats }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { GET as getObservability } from '@/app/api/admin/observability/route';
import { isProjectOwner, isProjectMember } from '@/lib/db/npq-permissions';

describe('full-test security regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires project membership before checking owner permissions', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce(null);

    const allowed = await isProjectOwner('user-1', 'project-1');

    expect(allowed).toBe(false);
    expect(mockPrisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: 'project-1', userId: 'user-1' } },
      select: { role: true },
    });
  });

  it('allows owner permissions only when member role is owner', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce({ role: 'owner' });

    const allowed = await isProjectOwner('user-1', 'project-1');

    expect(allowed).toBe(true);
  });

  it('denies owner permissions for plain member', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce({ role: 'member' });

    const allowed = await isProjectOwner('user-1', 'project-1');

    expect(allowed).toBe(false);
  });

  it('isProjectMember returns true for non-observer members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce({ role: 'member' });

    const result = await isProjectMember('user-1', 'project-1');

    expect(result).toBe(true);
  });

  it('isProjectMember returns false for observers', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce({ role: 'observer' });

    const result = await isProjectMember('user-1', 'project-1');

    expect(result).toBe(false);
  });

  it('blocks non-admin users from observability events', async () => {
    mockGetSession.mockResolvedValueOnce({ sub: 'user-1', role: 'user' });

    const res = await getObservability(new Request('http://localhost/api/admin/observability'));

    expect(res.status).toBe(403);
    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});
