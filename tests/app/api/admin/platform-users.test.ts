import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockRequireAdmin, mockJson, mockAssertAiAdmin, mockDatabase } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    data,
    status: (init as { status?: number })?.status ?? 200,
  })),
  mockAssertAiAdmin: vi.fn(),
  mockDatabase: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    positionRole: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userPosition: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    projectRole: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    aiResourceMembership: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    observabilityEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/database', () => ({
  db: mockDatabase,
  isUniqueViolation: vi.fn(() => false),
}));
vi.mock('@/platform/auth/auth.config', () => ({ getSession: mockGetSession }));
vi.mock('@/platform/permissions/system-admin', () => ({ requireSystemAdminApi: mockRequireAdmin }));
vi.mock('@/modules/ai-resources/guards', () => ({ assertNotLastEffectiveAdmin: mockAssertAiAdmin }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { GET, PATCH } from '@/app/api/admin/platform-users/route';

type MockResponse = { status: number; data: unknown };

const adminSession = { sub: 'admin-1', username: 'admin', platformRole: 'admin', role: 'admin' };
const subject = { id: 'user-1', username: 'alice', platformRole: 'user', role: 'user', status: 'active' };
const serializedUser = {
  ...subject,
  email: null,
  externalSource: null,
  source: 'local',
  positionBinding: undefined,
  aiResourceMembership: undefined,
  position: null,
  aiResourceRole: null,
  projectCount: 0,
  role: undefined,
};

describe('/api/admin/platform-users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ session: adminSession });
    mockDatabase.$transaction.mockImplementation(async (callback: (tx: typeof mockDatabase) => unknown) => callback(mockDatabase));
    mockDatabase.user.findUnique.mockResolvedValue(serializedUser);
    mockDatabase.observabilityEvent.create.mockResolvedValue({});
  });

  it('rejects a non-admin before reading any permission data', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ error: '需要系统管理员权限', status: 403 });

    const response = (await GET(new Request('http://localhost/api/admin/platform-users') as never)) as unknown as MockResponse;

    expect(response.status).toBe(403);
    expect(mockDatabase.user.findMany).not.toHaveBeenCalled();
  });

  it('protects the last active platform administrator', async () => {
    mockDatabase.user.findUnique.mockResolvedValueOnce({ id: 'admin-2', username: 'second', platformRole: 'admin', role: 'user', status: 'active' });
    mockDatabase.user.count.mockResolvedValueOnce(1);

    const response = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: 'admin-2', action: 'platform', platformRole: 'user' }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(409);
    expect(mockDatabase.user.update).not.toHaveBeenCalled();
    expect(mockDatabase.observabilityEvent.create).not.toHaveBeenCalled();
  });

  it('protects the last active AI resource administrator', async () => {
    mockDatabase.user.findUnique.mockResolvedValue(subject);
    mockAssertAiAdmin.mockRejectedValueOnce(new Error('不能移除末位有效模块管理员'));

    const response = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'ai-resource-role', role: 'reviewer' }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(409);
    expect(mockDatabase.aiResourceMembership.create).not.toHaveBeenCalled();
    expect(mockDatabase.observabilityEvent.create).not.toHaveBeenCalled();
  });

  it('updates platform role and records the cross-module permission audit', async () => {
    mockDatabase.user.findUnique.mockResolvedValue(subject);
    mockDatabase.user.count.mockResolvedValueOnce(2);

    const response = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'platform', platformRole: 'admin' }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(200);
    expect(mockDatabase.user.update).toHaveBeenCalledWith({
      where: { id: subject.id },
      data: { platformRole: 'admin', status: 'active' },
    });
    expect(mockDatabase.observabilityEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'USER_PERMISSION_CHANGED',
        userId: adminSession.sub,
      }),
    }));
  });

  it('updates AI role and workbench role through the same admin endpoint', async () => {
    mockDatabase.user.findUnique.mockResolvedValue(subject);
    mockDatabase.aiResourceMembership.findUnique.mockResolvedValue(null);

    const aiResponse = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'ai-resource-role', role: 'reviewer' }),
    }))) as unknown as MockResponse;
    const workbenchResponse = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'workbench-role', role: 'manager' }),
    }))) as unknown as MockResponse;

    expect(aiResponse.status).toBe(200);
    expect(workbenchResponse.status).toBe(200);
    expect(mockAssertAiAdmin).toHaveBeenCalledWith(mockDatabase, subject.id, 'reviewer');
    expect(mockDatabase.aiResourceMembership.create).toHaveBeenCalledWith({
      data: { userId: subject.id, role: 'reviewer', updatedById: adminSession.sub },
    });
    expect(mockDatabase.user.update).toHaveBeenCalledWith({
      where: { id: subject.id },
      data: { role: 'manager' },
    });
    expect(mockDatabase.observabilityEvent.create).toHaveBeenCalledTimes(2);
  });

  it('rejects manual position changes from the platform endpoint', async () => {
    mockDatabase.user.findUnique.mockResolvedValue(subject);

    const response = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'position', positionId: 'position-1' }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(400);
    expect(mockDatabase.userPosition.upsert).not.toHaveBeenCalled();
    expect(mockDatabase.userPosition.deleteMany).not.toHaveBeenCalled();
  });

  it('does not expose project membership writes from the platform endpoint', async () => {
    mockDatabase.user.findUnique.mockResolvedValue(subject);

    const response = (await PATCH(new Request('http://localhost/api/admin/platform-users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: subject.id, action: 'project', projectId: 'project-1', enabled: true }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(400);
    expect(mockDatabase.projectMember.create).not.toHaveBeenCalled();
  });
});
