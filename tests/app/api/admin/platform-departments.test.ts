import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAdmin, mockJson, mockDatabase } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    data,
    status: (init as { status?: number })?.status ?? 200,
  })),
  mockDatabase: {
    dingTalkDepartment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    userDingTalkDepartment: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/database', () => ({
  db: mockDatabase,
  isForeignKeyViolation: vi.fn(() => false),
  isUniqueViolation: vi.fn(() => false),
}));
vi.mock('@/platform/permissions/system-admin', () => ({ requireSystemAdminApi: mockRequireAdmin }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { DELETE, GET, PATCH, POST } from '@/app/api/admin/platform-departments/route';

type MockResponse = { data: unknown; status: number };

const adminSession = {
  sub: 'admin-1',
  username: 'admin',
  displayName: '管理员',
  platformRole: 'admin',
  role: 'admin',
};

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/admin/platform-departments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/platform-departments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ session: adminSession });
    mockDatabase.$transaction.mockImplementation(async (callback: (tx: typeof mockDatabase) => unknown) => callback(mockDatabase));
    mockDatabase.dingTalkDepartment.findMany.mockResolvedValue([]);
    mockDatabase.dingTalkDepartment.findUnique.mockResolvedValue({ id: 'root' });
    mockDatabase.dingTalkDepartment.upsert.mockResolvedValue({});
    mockDatabase.dingTalkDepartment.create.mockResolvedValue({});
    mockDatabase.dingTalkDepartment.update.mockResolvedValue({});
    mockDatabase.dingTalkDepartment.delete.mockResolvedValue({});
    mockDatabase.dingTalkDepartment.count.mockResolvedValue(0);
    mockDatabase.userDingTalkDepartment.count.mockResolvedValue(0);
  });

  it('rejects non-admin requests before reading mappings', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ error: '需要平台管理员权限', status: 403 });

    const response = (await GET({
      nextUrl: { searchParams: new URLSearchParams() },
    } as never)) as unknown as MockResponse;

    expect(response.status).toBe(403);
    expect(mockDatabase.dingTalkDepartment.findMany).not.toHaveBeenCalled();
  });

  it('imports parent IDs and upserts mappings without syncAt from JSON', async () => {
    const response = (await POST(jsonRequest({
      departments: [
        { id: 'root', name: '供应链质量部', parentId: null },
        { id: 'child', name: 'QCM组', parentId: 'root' },
      ],
    }))) as unknown as MockResponse;

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ count: 2 });
    expect(mockDatabase.dingTalkDepartment.upsert).toHaveBeenCalledTimes(2);
    expect(mockDatabase.dingTalkDepartment.upsert).toHaveBeenNthCalledWith(2, {
      where: { id: 'child' },
      create: expect.objectContaining({
        id: 'child',
        name: 'QCM组',
        parentId: 'root',
      }),
      update: expect.objectContaining({
        name: 'QCM组',
        parentId: 'root',
      }),
    });
  });

  it('rejects an import with an unknown parent ID', async () => {
    mockDatabase.dingTalkDepartment.findMany.mockResolvedValueOnce([]);

    const response = (await POST(jsonRequest({
      departments: [{ id: 'child', name: 'QCM组', parentId: 'missing' }],
    }))) as unknown as MockResponse;

    expect(response.status).toBe(400);
    expect(response.data).toEqual(expect.objectContaining({ error: expect.stringContaining('missing') }));
    expect(mockDatabase.$transaction).not.toHaveBeenCalled();
  });

  it('updates a mapping while keeping its ID stable', async () => {
    const response = (await PATCH(new Request('http://localhost/api/admin/platform-departments', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'child', name: 'QCM组（更新）', parentId: 'root' }),
    }))) as unknown as MockResponse;

    expect(response.status).toBe(200);
    expect(mockDatabase.dingTalkDepartment.update).toHaveBeenCalledWith({
      where: { id: 'child' },
      data: expect.objectContaining({ name: 'QCM组（更新）', parentId: 'root' }),
    });
  });

  it('blocks deletion while users or child mappings still reference the node', async () => {
    mockDatabase.userDingTalkDepartment.count.mockResolvedValueOnce(1);

    const response = (await DELETE({
      nextUrl: { searchParams: new URLSearchParams({ id: 'root' }) },
    } as never)) as unknown as MockResponse;

    expect(response.status).toBe(409);
    expect(mockDatabase.dingTalkDepartment.delete).not.toHaveBeenCalled();
  });
});
