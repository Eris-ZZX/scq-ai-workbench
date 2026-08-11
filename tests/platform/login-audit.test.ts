import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    authLoginLog: {
      create: mockCreate,
    },
  },
}));

import {
  parseAuthErrorParams,
  recordAuthLoginEvent,
  safeAuthErrorParams,
} from '@/platform/auth/login-audit';

describe('login audit safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
  });

  it('keeps only safe OAuth error parameters', () => {
    const url = new URL(
      'https://app.example.test/callback?error=access_denied&error_description=nope&code=secret&state=secret&token=secret',
    );

    expect(safeAuthErrorParams(url)).toEqual({
      error: 'access_denied',
      error_description: 'nope',
    });
  });

  it('ignores unsafe persisted error parameter keys', () => {
    expect(parseAuthErrorParams(JSON.stringify({
      error: 'access_denied',
      error_description: 'cancelled',
      code: 'must-not-export',
      state: 'must-not-export',
    }))).toEqual({
      error: 'access_denied',
      error_description: 'cancelled',
    });
  });

  it('redacts credentials and tokens before persisting an event', async () => {
    await recordAuthLoginEvent({
      request: new Request('https://app.example.test/api/auth/authing/callback', {
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '192.0.2.10, 192.0.2.11',
        },
      }),
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      username: '329662',
      errorCode: 'authing',
      errorMessage: 'access_token=secret password=secret state=secret',
      errorParams: { error: 'access_denied' },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: '329662',
        errorParams: '{"error":"access_denied"}',
        errorMessage: 'access_token=[REDACTED] password=[REDACTED] state=[REDACTED]',
        ipAddress: '192.0.2.10',
      }),
    });
  });

  it('preserves non-secret Authing claims while removing replay credentials', async () => {
    await recordAuthLoginEvent({
      request: new Request('https://app.example.test/api/auth/authing/callback'),
      provider: 'authing',
      stage: 'callback',
      outcome: 'failure',
      authingData: {
        idTokenClaims: {
          username: '314265',
          unionid: null,
          extended_fields: { emp_no: '314265' },
          nonce: 'must-not-persist',
        },
        userInfoClaims: {
          external_id: null,
          userpool_id: 'userpool',
          access_token: 'must-not-persist',
        },
      },
    });

    const data = mockCreate.mock.calls[0]?.[0].data as { authingData: string };
    expect(JSON.parse(data.authingData)).toEqual({
      idTokenClaims: {
        username: '314265',
        unionid: null,
        extended_fields: { emp_no: '314265' },
      },
      userInfoClaims: {
        external_id: null,
        userpool_id: 'userpool',
      },
    });
  });

  it('does not make login fail when audit persistence fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(recordAuthLoginEvent({
      request: new Request('https://app.example.test/api/auth/login'),
      provider: 'password',
      stage: 'credentials',
      outcome: 'failure',
      errorCode: 'invalid_credentials',
    })).resolves.toBeUndefined();
  });
});
