import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConsume, mockFindUnique, mockAudit } = vi.hoisted(() => ({
  mockConsume: vi.fn(),
  mockFindUnique: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('@/platform/sso/launch-code', () => ({
  DRAWING_RELIABILITY_APP_ID: 'sqm-drawing-reliability',
  consumeLaunchCode: mockConsume,
}));

vi.mock('@/lib/database', () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('@/platform/auth/login-audit', () => ({
  recordAuthLoginEvent: mockAudit,
}));

import { POST } from '@/app/api/platform/sso/launch-code/exchange/route';

const validHeaders = {
  Authorization: 'Bearer exchange-secret',
  'X-QE-SSO-Client-ID': 'sqm-drawing-reliability',
  'Content-Type': 'application/json',
};

function request(body: unknown, headers: Record<string, string> = validHeaders) {
  return new Request('http://localhost/api/platform/sso/launch-code/exchange', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('platform launch-code exchange', () => {
  beforeEach(() => {
    vi.stubEnv('SQM_LAUNCH_EXCHANGE_SECRET', 'exchange-secret');
    vi.stubEnv('SQM_LAUNCH_CLIENT_ID', 'sqm-drawing-reliability');
    mockConsume.mockReset();
    mockFindUnique.mockReset();
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
  });

  it('rejects invalid client credentials before consuming a code', async () => {
    const response = await POST(request(
      { appId: 'sqm-drawing-reliability', code: 'opaque-code' },
      { ...validHeaders, Authorization: 'Bearer wrong-secret' },
    ));

    expect(response.status).toBe(401);
    expect(mockConsume).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'failure',
      errorCode: 'invalid_client_credentials',
    }));
  });

  it('rejects expired or replayed codes', async () => {
    mockConsume.mockResolvedValue(null);

    const response = await POST(request({
      appId: 'sqm-drawing-reliability',
      code: 'opaque-code',
    }));

    expect(response.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'failure',
      errorCode: 'launch_code_rejected',
    }));
  });

  it('rejects a code addressed to a different application', async () => {
    const response = await POST(request({
      appId: 'other-application',
      code: 'opaque-code',
    }));

    expect(response.status).toBe(400);
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it('returns only the active user identity after atomic consumption', async () => {
    mockConsume.mockResolvedValue({ subjectUserId: 'qe-user-1' });
    mockFindUnique.mockResolvedValue({
      id: 'qe-user-1',
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.test',
      role: 'user',
      platformRole: 'user',
      status: 'active',
    });

    const response = await POST(request({
      appId: 'sqm-drawing-reliability',
      code: 'opaque-code',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appId: 'sqm-drawing-reliability',
      sub: 'qe-user-1',
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.test',
      role: 'user',
      platformRole: 'user',
    });
    expect(mockConsume).toHaveBeenCalledWith('opaque-code', 'sqm-drawing-reliability');
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success',
      userId: 'qe-user-1',
      username: 'alice',
    }));
  });

  it('does not exchange a code for a disabled user', async () => {
    mockConsume.mockResolvedValue({ subjectUserId: 'qe-user-disabled' });
    mockFindUnique.mockResolvedValue({
      id: 'qe-user-disabled',
      username: 'disabled',
      displayName: 'Disabled',
      email: null,
      role: 'user',
      platformRole: 'user',
      status: 'disabled',
    });

    const response = await POST(request({
      appId: 'sqm-drawing-reliability',
      code: 'opaque-code',
    }));

    expect(response.status).toBe(401);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'failure',
      errorCode: 'user_inactive',
    }));
  });
});
