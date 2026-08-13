import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuth,
  mockGetRecords,
  mockSaveRegistry,
  mockGetAdminSettings,
  mockSaveConnection,
  mockDeleteConnection,
  mockTestConnection,
  mockLogEvent,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetRecords: vi.fn(),
  mockSaveRegistry: vi.fn(),
  mockGetAdminSettings: vi.fn(),
  mockSaveConnection: vi.fn(),
  mockDeleteConnection: vi.fn(),
  mockTestConnection: vi.fn(),
  mockLogEvent: vi.fn(),
}));

vi.mock('@/platform/permissions/system-admin', () => ({
  requireSystemAdminApi: mockAuth,
}));

vi.mock('@/lib/platform/apps/registry', () => ({
  getPlatformAppRecords: mockGetRecords,
  savePlatformAppSettings: mockSaveRegistry,
}));

vi.mock('@/lib/platform/apps/admin', () => ({
  getPlatformAppAdminSettings: mockGetAdminSettings,
}));

vi.mock('@/platform/sso/external-connection', () => ({
  ExternalConnectionError: class ExternalConnectionError extends Error {
    code = 'EXTERNAL_APP_ERROR';
  },
  deleteExternalAppConnection: mockDeleteConnection,
  saveExternalAppConnection: mockSaveConnection,
  testExternalAppConnection: mockTestConnection,
}));

vi.mock('@/lib/platform/observability/logger', () => ({
  logEvent: mockLogEvent,
}));

import {
  DELETE,
  POST,
  PUT,
} from '@/app/api/admin/platform-apps/[id]/route';

const externalApp = {
  id: 'quality-link',
  parentId: null,
  href: '/portal/external-apps/quality-link',
  title: '质量外部系统',
  description: '外部系统',
  iconKey: 'boxes' as const,
  state: 'active' as const,
  access: 'authenticated' as const,
  launchMode: 'external-link' as const,
  sortOrder: 10,
  builtin: false,
};

function request(method: string, body?: unknown) {
  return new Request('http://localhost/api/admin/platform-apps/quality-link', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const context = {
  params: Promise.resolve({ id: externalApp.id }),
};

describe('platform app administration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ session: { sub: 'admin-1' } });
    mockGetRecords.mockResolvedValue([externalApp]);
    mockSaveRegistry.mockResolvedValue({ apps: [externalApp] });
    mockGetAdminSettings.mockResolvedValue({ apps: [externalApp] });
    mockSaveConnection.mockResolvedValue({
      appId: externalApp.id,
      displayName: externalApp.title,
    });
    mockDeleteConnection.mockResolvedValue(undefined);
    mockTestConnection.mockResolvedValue({
      ok: true,
      statusCode: null,
      latencyMs: 0,
      message: '外挂应用地址格式有效，可通过新标签页打开。',
    });
    mockLogEvent.mockResolvedValue(undefined);
  });

  it('enforces the system-admin boundary', async () => {
    mockAuth.mockResolvedValueOnce({ error: '未登录', status: 401 });

    const response = await PUT(request('PUT', { app: externalApp, connection: {} }), context);

    expect(response.status).toBe(401);
    expect(mockSaveRegistry).not.toHaveBeenCalled();
  });

  it('saves a mode-specific external connection without exposing secrets', async () => {
    const app = { ...externalApp, launchMode: 'external-sso' as const };
    const response = await PUT(request('PUT', {
      app,
      connection: {
        launchUrl: 'https://quality.example.test',
        note: '生产环境',
        exchangeSecret: 'one-time-secret',
        enabled: true,
      },
    }), context);

    expect(response.status).toBe(200);
    expect(mockSaveConnection).toHaveBeenCalledWith(expect.objectContaining({
      appId: externalApp.id,
      mode: 'external-sso',
      launchUrl: 'https://quality.example.test',
      exchangeSecret: 'one-time-secret',
      enabled: true,
      updatedByUserId: 'admin-1',
    }));
    await expect(response.json()).resolves.toEqual({ apps: [externalApp] });
  });

  it('tests only configured external applications', async () => {
    const response = await POST(request('POST', { action: 'test-connection' }), context);

    expect(response.status).toBe(200);
    expect(mockTestConnection).toHaveBeenCalledWith(externalApp.id, 'external-link');
  });

  it('does not delete builtin applications', async () => {
    mockGetRecords.mockResolvedValue([{ ...externalApp, builtin: true }]);

    const response = await DELETE(request('DELETE'), context);

    expect(response.status).toBe(400);
    expect(mockSaveRegistry).not.toHaveBeenCalled();
  });
});
